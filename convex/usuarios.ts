import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * TODO(MID-7): sin autenticación ni autorización real todavía. Estas funciones
 * no verifican quién llama; son aceptables solo contra el deployment de
 * desarrollo, sin datos reales de clientes del negocio (ver plan de MID-18/MID-10).
 */

const USUARIOS_SEED = [
  { nombre: "Emiliana", email: "emiliana@vibe-crm.local", rol: "propietaria" as const },
  { nombre: "Marcelo", email: "marcelo@vibe-crm.local", rol: "comercial" as const },
];

/**
 * Idempotente por email, no por "tabla vacía": una tabla parcialmente poblada
 * (p. ej. solo existe Marcelo) no deja a nadie sin crear. Seguro de llamar en
 * cualquier estado del deployment.
 */
export const asegurarSeed = mutation({
  args: {},
  handler: async (ctx) => {
    for (const persona of USUARIOS_SEED) {
      const existente = await ctx.db
        .query("usuarios")
        .withIndex("by_email", (q) => q.eq("email", persona.email))
        .unique();
      if (!existente) {
        await ctx.db.insert("usuarios", persona);
      }
    }
  },
});

export const obtenerPorEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    // No se devuelve el documento completo (incluiría el email) — la UI solo
    // necesita identidad y rol para la sesión.
    return usuario ? { _id: usuario._id, nombre: usuario.nombre, rol: usuario.rol } : null;
  },
});

export const listar = query({
  args: {},
  handler: async (ctx) => {
    const usuarios = await ctx.db.query("usuarios").collect();
    // Idem: se recorta a los campos que la UI necesita (p. ej. resolver
    // responsableId → nombre), sin exponer el email de cada usuario.
    return usuarios.map((usuario) => ({
      _id: usuario._id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    }));
  },
});
