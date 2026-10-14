import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { requireUsuario } from "./authHelpers";

/**
 * MID-20: modelo de datos de Venta u oportunidad (tabla `ventas`, ver
 * convex/schema.ts) — igual que `interacciones`, la tabla ya existía en el
 * esquema desde un trabajo previo, sin queries/mutations propias hasta ahora.
 *
 * MID-7: todas las queries/mutations exigen sesión real (`requireUsuario`).
 */

// Mismo criterio de límite explícito que interacciones.ts/seguimientos.ts:
// MVP de negocio pequeño (decenas de ventas por cliente, no miles).
const LIMITE_HISTORIAL = 100;

// MID-23: límite del listado agregado de Ventas y oportunidades (mismo valor
// y mismo criterio que `clientes.listar`). Las métricas y los contadores de
// los chips de filtro NO salen de esta lista acotada — ver `resumen` abajo.
const LIMITE_LISTADO = 500;

/**
 * Hallazgo de auditoría: `importe > 0` no bastaba — una llamada directa a la
 * mutation (sin pasar por la máscara de centavos del overlay) podía mandar
 * más de dos decimales (ej. 1.234), guardando un valor que `formatCurrency`
 * redondearía al mostrarlo, desincronizando lo guardado de lo mostrado. Se
 * valida la precisión de centavos en el servidor, no solo en la UI — mismo
 * criterio que el resto de validaciones de este archivo (MID-7: no confiar
 * en que el cliente respete el contrato).
 *
 * Segunda ronda: un tope en dólares (ej. "$1,000,000") es una decisión de
 * producto que nadie pidió — se reemplaza por `Number.isSafeInteger(centavos)`,
 * una cota puramente técnica, sin inventar un límite de negocio.
 *
 * Tercera ronda: `importe > 0` seguía dejando pasar un borde — un `importe`
 * positivo pero menor a medio centavo (ej. `1e-9`) redondea a `centavos = 0`,
 * dentro de la tolerancia de punto flotante, y se guardaba tal cual, no su
 * versión normalizada — el historial lo mostraría como `$0.00`, violando el
 * contrato de "al menos un centavo". Por eso esta función ahora **devuelve**
 * el importe ya normalizado (`centavos / 100`) en vez de solo validar: lo que
 * se guarda en `ventas.importe` es exactamente lo que `centavos` representa,
 * nunca el valor crudo que mandó quien llamó a la mutation.
 */
function normalizarImporte(importe: number): number {
  if (!(importe > 0)) {
    throw new Error("El importe debe ser mayor a cero.");
  }
  const centavos = Math.round(importe * 100);
  if (!Number.isSafeInteger(centavos) || centavos < 1) {
    throw new Error("El importe debe ser de al menos un centavo.");
  }
  if (Math.abs(importe * 100 - centavos) > 1e-6) {
    throw new Error("El importe no puede tener más de dos decimales.");
  }
  return centavos / 100;
}

/**
 * MID-22: recalcula el Estado del cliente cada vez que se registra una venta.
 * Usa existencia indexada (`by_cliente_estado`, `.first()`) en vez de traer
 * todas las ventas del cliente a memoria — el costo no crece con el tamaño
 * del historial. Nota de alcance: solo se dispara al *crear* una venta; no
 * hay mutation de editar/eliminar venta en este MVP, así que si se agrega una
 * en el futuro deberá llamar a esta misma función.
 */
async function recalcularEstadoCliente(ctx: MutationCtx, clienteId: Id<"clientes">) {
  const tieneAlguna = await ctx.db
    .query("ventas")
    .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
    .first();
  if (!tieneAlguna) {
    await ctx.db.patch(clienteId, { estado: "nuevo_lead" });
    return;
  }

  const tieneAbierta = await ctx.db
    .query("ventas")
    .withIndex("by_cliente_estado", (q) =>
      q.eq("clienteId", clienteId).eq("estado", "oportunidad_abierta")
    )
    .first();
  if (tieneAbierta) {
    await ctx.db.patch(clienteId, { estado: "en_negociacion" });
    return;
  }

  const tieneGanada = await ctx.db
    .query("ventas")
    .withIndex("by_cliente_estado", (q) => q.eq("clienteId", clienteId).eq("estado", "ganada"))
    .first();
  if (tieneGanada) {
    await ctx.db.patch(clienteId, { estado: "ganado" });
    return;
  }

  // Por exhaustión: tiene al menos una venta, ninguna abierta, ninguna
  // ganada — el resto solo puede ser "perdida".
  await ctx.db.patch(clienteId, { estado: "perdido" });
}

type EstadoVenta = "oportunidad_abierta" | "ganada" | "perdida";

const ERROR_RESUMEN_FUERA_DE_RANGO =
  "El resumen de ventas superó un rango seguro de cálculo.";

/**
 * MID-23: mantiene `resumenVentas` (documento único, ver convex/schema.ts) al
 * día de forma incremental, para que la pantalla "Ventas y oportunidades"
 * pueda leer sus métricas en O(1) en vez de escanear toda la tabla `ventas`
 * en cada apertura.
 *
 * Deduplicación por documento, no por tiempo (hallazgo de auditoría, rondas
 * 5/6): un corte basado en `Date.now()`/`_creationTime` no garantiza el orden
 * real de *commit* de las transacciones bajo reintentos de OCC, así que
 * comparar por tiempo podía clasificar mal una venta y contarla dos veces.
 * En cambio, cada venta se marca `contadoEnResumen: true` en la **misma
 * transacción** que la suma al resumen — la pregunta "¿ya se contó esta
 * venta?" se resuelve leyendo el propio documento de la venta, nunca
 * comparando relojes de transacciones distintas. Eso hace esta función
 * segura de llamar más de una vez para la misma venta (la llama tanto
 * `crear` como el backfill) y segura ante altas concurrentes: si dos
 * llamadas leen la misma venta sin marcar, el OCC de Convex serializa/
 * reintenta una de las dos, que al reintentar ve el flag ya en `true` y no
 * hace nada.
 */
async function incrementarResumen(
  ctx: MutationCtx,
  ventaId: Id<"ventas">,
  estado: EstadoVenta,
  centavos: number
) {
  const venta = await ctx.db.get(ventaId);
  if (!venta || venta.contadoEnResumen) return;

  const existente = await ctx.db.query("resumenVentas").first();
  const resumenId =
    existente?._id ??
    (await ctx.db.insert("resumenVentas", {
      enMarchaCentavos: 0,
      enMarchaCantidad: 0,
      ganadaCentavos: 0,
      ganadaCantidad: 0,
      perdidaCentavos: 0,
      perdidaCantidad: 0,
    }));
  const resumen = existente ?? (await ctx.db.get(resumenId))!;

  switch (estado) {
    case "oportunidad_abierta": {
      const centavosNuevos = resumen.enMarchaCentavos + centavos;
      if (!Number.isSafeInteger(centavosNuevos)) throw new Error(ERROR_RESUMEN_FUERA_DE_RANGO);
      await ctx.db.patch(resumenId, {
        enMarchaCentavos: centavosNuevos,
        enMarchaCantidad: resumen.enMarchaCantidad + 1,
      });
      break;
    }
    case "ganada": {
      const centavosNuevos = resumen.ganadaCentavos + centavos;
      if (!Number.isSafeInteger(centavosNuevos)) throw new Error(ERROR_RESUMEN_FUERA_DE_RANGO);
      await ctx.db.patch(resumenId, {
        ganadaCentavos: centavosNuevos,
        ganadaCantidad: resumen.ganadaCantidad + 1,
      });
      break;
    }
    case "perdida": {
      const centavosNuevos = resumen.perdidaCentavos + centavos;
      if (!Number.isSafeInteger(centavosNuevos)) throw new Error(ERROR_RESUMEN_FUERA_DE_RANGO);
      await ctx.db.patch(resumenId, {
        perdidaCentavos: centavosNuevos,
        perdidaCantidad: resumen.perdidaCantidad + 1,
      });
      break;
    }
  }

  await ctx.db.patch(ventaId, { contadoEnResumen: true });
}

/**
 * Ficha de cliente (MID-21): historial cronológico por `fecha` (la que elige
 * la persona usuaria al registrar la venta, no `_creationTime`) — por eso usa
 * el índice compuesto `by_cliente_fecha` en vez del `.order("desc")` por
 * defecto que usa `interacciones.listarPorCliente`.
 */
export const listarPorCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUsuario(ctx);
    const ventas = await ctx.db
      .query("ventas")
      .withIndex("by_cliente_fecha", (q) => q.eq("clienteId", clienteId))
      .order("desc")
      .take(LIMITE_HISTORIAL);

    return ventas.map((venta) => ({
      _id: venta._id,
      concepto: venta.concepto,
      importe: venta.importe,
      estado: venta.estado,
      fecha: venta.fecha,
    }));
  },
});

/**
 * MID-23: listado agregado para la pantalla "Ventas y oportunidades" — todas
 * las ventas del negocio (no de un cliente puntual), ordenadas por `fecha`
 * vía el índice global `by_fecha` y acotadas a `LIMITE_LISTADO`. El límite lo
 * aplica el índice (no un `.collect()` + sort en memoria), así que acota el
 * trabajo real de la consulta, no solo el tamaño de la respuesta. Esta lista
 * puede no incluir el negocio completo más allá de ese límite — las métricas
 * y los contadores de los chips de filtro nunca salen de acá, ver `resumen`.
 */
export const listarTodas = query({
  args: {},
  handler: async (ctx) => {
    await requireUsuario(ctx);
    const ventas = await ctx.db
      .query("ventas")
      .withIndex("by_fecha")
      .order("desc")
      .take(LIMITE_LISTADO);

    return await Promise.all(
      ventas.map(async (venta) => {
        const cliente = await ctx.db.get(venta.clienteId);
        return {
          _id: venta._id,
          concepto: venta.concepto,
          importe: venta.importe,
          estado: venta.estado,
          fecha: venta.fecha,
          clienteId: venta.clienteId,
          cliente: cliente ? { nombre: cliente.nombre } : null,
        };
      })
    );
  },
});

/**
 * MID-23: métricas ("en marcha"/"ganado") y contadores de los 4 chips de
 * filtro de la pantalla "Ventas y oportunidades" — lectura O(1) del
 * documento único `resumenVentas` (mantenido por `incrementarResumen`), no
 * un escaneo de `ventas`. Por eso son correctos sin importar cuántas ventas
 * tenga el negocio, a diferencia de `listarTodas`, que sí está acotada.
 */
export const resumen = query({
  args: {},
  handler: async (ctx) => {
    await requireUsuario(ctx);
    const r = await ctx.db.query("resumenVentas").first();
    const enMarcha = { suma: (r?.enMarchaCentavos ?? 0) / 100, cantidad: r?.enMarchaCantidad ?? 0 };
    const ganadas = { suma: (r?.ganadaCentavos ?? 0) / 100, cantidad: r?.ganadaCantidad ?? 0 };
    const perdidas = { suma: (r?.perdidaCentavos ?? 0) / 100, cantidad: r?.perdidaCantidad ?? 0 };
    return {
      totalVentas: enMarcha.cantidad + ganadas.cantidad + perdidas.cantidad,
      enMarcha,
      ganadas,
      perdidas,
    };
  },
});

/**
 * MID-21: registrar una venta/oportunidad desde la Ficha de cliente (o, con
 * el mismo formulario, desde el selector de cliente de Hoy o de la pantalla
 * Ventas). El autor es quien tiene la sesión (MID-7) — misma razón que
 * `interacciones.crear`.
 */
export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    concepto: v.string(),
    importe: v.number(),
    estado: v.union(
      v.literal("oportunidad_abierta"),
      v.literal("ganada"),
      v.literal("perdida")
    ),
    fecha: v.number(),
  },
  handler: async (ctx, args) => {
    const usuario = await requireUsuario(ctx);
    const conceptoLimpio = args.concepto.trim();
    if (!conceptoLimpio) {
      throw new Error("El concepto de la venta no puede estar vacío.");
    }
    const importe = normalizarImporte(args.importe);
    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente) {
      throw new Error("El cliente no existe.");
    }
    const id = await ctx.db.insert("ventas", {
      clienteId: args.clienteId,
      concepto: conceptoLimpio,
      importe,
      estado: args.estado,
      fecha: args.fecha,
      autorId: usuario._id,
    });
    await recalcularEstadoCliente(ctx, args.clienteId);
    await incrementarResumen(ctx, id, args.estado, Math.round(importe * 100));
    return id;
  },
});

/**
 * MID-23: migración de una sola vez — inicializa `resumenVentas` a partir de
 * ventas que ya existían antes de que este campo/mecanismo existiera (p. ej.
 * las registradas por MID-20/21/22 en cualquier deployment, antes de este
 * cambio). Paginada (500 ventas por llamada, ver `LIMITE_LISTADO`) para no
 * chocar con los límites de lectura de Convex por ejecución, sin importar
 * cuán grande sea el historial. Segura de correr más de una vez, e incluso en
 * paralelo con altas nuevas vía `crear`: `incrementarResumen` es idempotente
 * por venta (ver su comentario), así que recorrer una venta ya contada es un
 * no-op. Correr manualmente después de desplegar este cambio:
 *   npx convex run ventas:backfillResumen           (deployment de dev)
 *   npx convex run ventas:backfillResumen --prod    (producción, si aplica)
 * No correr dos instancias de esta migración en simultáneo contra el mismo
 * deployment — no es un caso que la lógica anterior necesite cubrir para una
 * migración manual de una sola vez.
 */
export const _backfillResumenBatch = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const pagina = await ctx.db.query("ventas").paginate({ cursor: cursor ?? null, numItems: 500 });
    for (const venta of pagina.page) {
      const centavos = Math.round(venta.importe * 100);
      await incrementarResumen(ctx, venta._id, venta.estado, centavos);
    }
    return { continueCursor: pagina.continueCursor, isDone: pagina.isDone };
  },
});

export const backfillResumen = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | undefined;
    let isDone = false;
    while (!isDone) {
      const resultado = await ctx.runMutation(internal.ventas._backfillResumenBatch, { cursor });
      cursor = resultado.continueCursor;
      isDone = resultado.isDone;
    }
    return { ok: true };
  },
});
