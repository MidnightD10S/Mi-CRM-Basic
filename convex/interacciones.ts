import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUsuario } from "./authHelpers";

/**
 * MID-14: modelo de datos de Interacción (tabla `interacciones`, ver
 * convex/schema.ts) — ya existía en el esquema desde MID-13/19, pero sin
 * queries/mutations propias hasta ahora.
 *
 * MID-7: todas las queries/mutations exigen sesión real (`requireUsuario`).
 */

// Mismo criterio de límite explícito que seguimientos.ts: MVP de negocio
// pequeño (decenas de interacciones por cliente, no miles).
const LIMITE_HISTORIAL = 100;

/**
 * Ficha de cliente (MID-19): historial cronológico, lo más reciente primero.
 */
export const listarPorCliente = query({
  args: { clienteId: v.id("clientes") },
  handler: async (ctx, { clienteId }) => {
    await requireUsuario(ctx);
    const interacciones = await ctx.db
      .query("interacciones")
      .withIndex("by_cliente", (q) => q.eq("clienteId", clienteId))
      .order("desc")
      .take(LIMITE_HISTORIAL);

    return await Promise.all(
      interacciones.map(async (interaccion) => {
        const autor = await ctx.db.get(interaccion.autorId);
        return {
          _id: interaccion._id,
          tipo: interaccion.tipo,
          nota: interaccion.nota,
          fecha: interaccion.fecha,
          autor: autor ? { nombre: autor.nombre } : null,
        };
      })
    );
  },
});

/**
 * MID-16: registrar una interacción desde la Ficha de cliente (o, con el
 * mismo formulario, desde el selector de cliente de Tareas del día). El
 * autor es quien tiene la sesión (MID-7), no un id que mande el cliente —
 * misma razón que `seguimientos.crearTarea`.
 */
// Hoy (feed de negocio): mismo criterio de límite MVP que el resto del
// archivo. No hace falta índice nuevo — igual que clientes.buscar/listar,
// el orden por defecto (.order("desc") sobre _creationTime, que coincide con
// `fecha` porque `crear` siempre la fija a Date.now() al insertar) alcanza
// para este volumen; un índice compuesto por fecha sería prematuro sin
// paginación real.
const LIMITE_RECIENTES = 20;

/**
 * Hoy: actividad reciente de todo el negocio, no solo la propia — mismo
 * criterio ya usado en `seguimientos.listarPendientes` (MID-18). Esta app no
 * es multi-tenant (ninguna tabla tiene `negocioId`), así que "todo el
 * negocio" es literalmente todo el dataset.
 */
export const listarRecientes = query({
  args: {},
  handler: async (ctx) => {
    await requireUsuario(ctx);
    const interacciones = await ctx.db.query("interacciones").order("desc").take(LIMITE_RECIENTES);
    return await Promise.all(
      interacciones.map(async (interaccion) => {
        const [cliente, autor] = await Promise.all([
          ctx.db.get(interaccion.clienteId),
          ctx.db.get(interaccion.autorId),
        ]);
        return {
          _id: interaccion._id,
          tipo: interaccion.tipo,
          nota: interaccion.nota,
          fecha: interaccion.fecha,
          clienteId: interaccion.clienteId,
          cliente: cliente ? { nombre: cliente.nombre } : null,
          autor: autor ? { nombre: autor.nombre } : null,
        };
      })
    );
  },
});

export const crear = mutation({
  args: {
    clienteId: v.id("clientes"),
    tipo: v.union(
      v.literal("llamada"),
      v.literal("email"),
      v.literal("whatsapp"),
      v.literal("en_persona")
    ),
    nota: v.string(),
  },
  handler: async (ctx, args) => {
    const usuario = await requireUsuario(ctx);
    const notaLimpia = args.nota.trim();
    if (!notaLimpia) {
      throw new Error("La nota no puede estar vacía.");
    }
    const cliente = await ctx.db.get(args.clienteId);
    if (!cliente) {
      throw new Error("El cliente no existe.");
    }
    return await ctx.db.insert("interacciones", {
      clienteId: args.clienteId,
      tipo: args.tipo,
      nota: notaLimpia,
      fecha: Date.now(),
      autorId: usuario._id,
    });
  },
});
