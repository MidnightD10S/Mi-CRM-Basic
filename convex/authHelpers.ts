import type { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Exige sesión Y que la identidad autenticada corresponda a una fila de
 * `usuarios` — no solo "hay alguna cuenta de Convex Auth válida" (MID-7).
 * Usar al inicio de toda query o mutation que lea o escriba datos del
 * negocio (clientes, seguimientos). La protección vive aquí, en el backend,
 * no en el guard de rutas de la UI — cualquiera con la URL del deployment
 * podría llamar a estas funciones directamente sin pasar por `/login`.
 */
export async function requireUsuario(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) throw new Error("No autenticado.");
  const usuario = await ctx.db
    .query("usuarios")
    .withIndex("by_email", (q) => q.eq("email", identity.email!))
    .unique();
  if (!usuario) throw new Error("No autorizado.");
  return usuario;
}
