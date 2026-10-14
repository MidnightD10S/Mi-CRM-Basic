import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
 * MID-21: registrar una venta/oportunidad desde la Ficha de cliente (o, con
 * el mismo formulario, desde el selector de cliente de Hoy). El autor es
 * quien tiene la sesión (MID-7) — misma razón que `interacciones.crear`.
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
    if (!(args.importe > 0)) {
      throw new Error("El importe debe ser mayor a cero.");
    }
    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente) {
      throw new Error("El cliente no existe.");
    }
    const id = await ctx.db.insert("ventas", {
      clienteId: args.clienteId,
      concepto: conceptoLimpio,
      importe: args.importe,
      estado: args.estado,
      fecha: args.fecha,
      autorId: usuario._id,
    });
    await recalcularEstadoCliente(ctx, args.clienteId);
    return id;
  },
});
