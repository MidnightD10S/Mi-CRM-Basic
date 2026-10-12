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
    const seguimientos = await ctx.db
      .query("seguimientos")
      .withIndex("by_hecho_vence", (q) => q.eq("hecho", false))
      .order("asc")
      .take(LIMITE_PENDIENTES);

    return await Promise.all(
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
  },
});

export const crearTarea = mutation({
  args: {
    accion: v.string(),
    clienteId: v.id("clientes"),
    vence: v.number(),
  },
  handler: async (ctx, args) => {
    // MID-7: el responsable es quien tiene la sesión, no un id que mande el
    // cliente — evita crear una tarea a nombre de otra persona con una
    // sesión propia válida.
    const usuario = await requireUsuario(ctx);
    const accionLimpia = args.accion.trim();
    if (!accionLimpia) {
      throw new Error("El título de la tarea no puede estar vacío.");
    }
    return await ctx.db.insert("seguimientos", {
      accion: accionLimpia,
      clienteId: args.clienteId,
      vence: args.vence,
      responsableId: usuario._id,
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
