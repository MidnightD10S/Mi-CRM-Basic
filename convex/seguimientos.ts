import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUsuario } from "./authHelpers";

/**
 * MID-7: todas las queries/mutations exigen sesión real (`requireUsuario`).
 *
 * MID-18: todas las personas ven todos los seguimientos pendientes del
 * negocio, sin filtrar por responsable.
 */

// Límite explícito: MVP de negocio pequeño. Si el volumen creciera, paginar
// sería un cambio aparte.
const LIMITE_PENDIENTES = 100;

export const listarPendientes = query({
  args: {},
  handler: async (ctx) => {
    await requireUsuario(ctx);
    // Se pide uno de más que LIMITE_PENDIENTES para saber si hay seguimientos
    // pendientes más allá del corte (los que vencen más tarde, al estar
    // ordenados `asc` por `vence`) sin necesitar un `count` aparte.
    const encontrados = await ctx.db
      .query("seguimientos")
      .withIndex("by_hecho_vence", (q) => q.eq("hecho", false))
      .order("asc")
      .take(LIMITE_PENDIENTES + 1);
    const truncado = encontrados.length > LIMITE_PENDIENTES;
    const seguimientos = encontrados.slice(0, LIMITE_PENDIENTES);

    const items = await Promise.all(
      seguimientos.map(async (seguimiento) => {
        const [cliente, responsable] = await Promise.all([
          ctx.db.get(seguimiento.clienteId),
          ctx.db.get(seguimiento.responsableId),
        ]);
        return {
          ...seguimiento,
          cliente: cliente ? { nombre: cliente.nombre, estado: cliente.estado } : null,
          responsable: responsable ? { nombre: responsable.nombre } : null,
        };
      })
    );

    return { items, truncado };
  },
});

/**
 * Ficha de cliente (MID-19): seguimientos pendientes de un cliente puntual —
 * distinto de `listarPendientes` (todos los del negocio, usado en Hoy). Se
 * filtra `hecho` en memoria sobre `by_cliente` en vez de añadir un índice
 * compuesto nuevo: el volumen por cliente es chico (MVP de negocio pequeño).
 */
export const listarPendientesPorCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUsuario(ctx);
    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .collect();
    const pendientes = seguimientos.filter((s) => !s.hecho).sort((a, b) => a.vence - b.vence);
    return await Promise.all(
      pendientes.map(async (seguimiento) => {
        const responsable = await ctx.db.get(seguimiento.responsableId);
        return {
          _id: seguimiento._id,
          accion: seguimiento.accion,
          vence: seguimiento.vence,
          responsable: responsable ? { nombre: responsable.nombre } : null,
        };
      })
    );
  },
});

/**
 * MID-17/MID-18: "Nueva tarea" (Hoy) y "Programar seguimiento" (Ficha) son
 * dos UIs distintas para la misma entidad — no se fusionan sus campos, pero
 * comparten esta mutation. `responsableId` es opcional para no romper el
 * flujo existente de Hoy (nunca lo manda, sigue autoasignando a la sesión).
 * Cuando la Ficha lo manda (reasignación a la otra persona del equipo), se
 * valida contra `usuarios` en vez de confiar en el tipo `v.id` — ese tipo
 * solo valida la forma del string, no que el documento exista (MID-7: no
 * confiar en ids que manda el cliente sin verificarlos). Por el mismo motivo
 * se valida que `clienteId` exista.
 */
export const crearTarea = mutation({
  args: {
    accion: v.string(),
    clienteId: v.id("clientes"),
    vence: v.number(),
    responsableId: v.optional(v.id("usuarios")),
  },
  handler: async (ctx, args) => {
    const usuario = await requireUsuario(ctx);
    const accionLimpia = args.accion.trim();
    if (!accionLimpia) {
      throw new Error("El título de la tarea no puede estar vacío.");
    }
    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente) {
      throw new Error("El cliente no existe.");
    }
    let responsableId = usuario._id;
    if (args.responsableId) {
      const responsable = await ctx.db.get(args.responsableId);
      if (!responsable) {
        throw new Error("El responsable elegido no existe.");
      }
      responsableId = args.responsableId;
    }
    return await ctx.db.insert("seguimientos", {
      accion: accionLimpia,
      clienteId: args.clienteId,
      vence: args.vence,
      responsableId,
      hecho: false,
    });
  },
});

/**
 * Invariante: `fechaHecho` está definida si y solo si `hecho === true`.
 */
export const marcarHecho = mutation({
  args: { id: v.id("seguimientos") },
  handler: async (ctx, { id }) => {
    await requireUsuario(ctx);
    await ctx.db.patch(id, { hecho: true, fechaHecho: Date.now() });
  },
});

export const deshacerHecho = mutation({
  args: { id: v.id("seguimientos") },
  handler: async (ctx, { id }) => {
    await requireUsuario(ctx);
    await ctx.db.patch(id, { hecho: false, fechaHecho: undefined });
  },
});
