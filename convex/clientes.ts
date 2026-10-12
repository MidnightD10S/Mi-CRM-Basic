import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * TODO(MID-7): sin autenticación ni autorización real todavía (ver TODO en
 * convex/usuarios.ts). Alcance mínimo para MID-18 (selector de cliente de
 * "Nueva tarea"); el alta completa es MID-11.
 */

// Límite explícito: MVP de negocio pequeño (decenas de clientes, no miles).
// Si el volumen creciera, paginar sería un cambio aparte.
const LIMITE_BUSQUEDA = 20;

export const buscar = query({
  args: { texto: v.string() },
  handler: async (ctx, { texto }) => {
    if (texto.trim() === "") {
      return await ctx.db.query("clientes").order("desc").take(LIMITE_BUSQUEDA);
    }
    return await ctx.db
      .query("clientes")
      .withSearchIndex("search_nombre", (q) => q.search("nombre", texto))
      .take(LIMITE_BUSQUEDA);
  },
});

export const crearMinimo = mutation({
  args: {
    nombre: v.string(),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { nombre, telefono, email }) => {
    // El tipo `v.string()` no impide una cadena vacía o solo espacios — Convex
    // es una función pública (sin auth todavía, ver TODO arriba) que puede
    // invocarse sin pasar por el formulario, así que la invariante de "no
    // vacío" se valida aquí, no solo en la UI.
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      throw new Error("El nombre del cliente no puede estar vacío.");
    }
    const telefonoLimpio = telefono?.trim();
    const emailLimpio = email?.trim();
    return await ctx.db.insert("clientes", {
      nombre: nombreLimpio,
      telefono: telefonoLimpio || undefined,
      email: emailLimpio || undefined,
      estado: "nuevo_lead",
      creadoEn: Date.now(),
    });
  },
});
