import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Exige sesión Y que la identidad autenticada corresponda a una fila de
 * `usuarios` — no solo "hay alguna cuenta de Convex Auth válida" (MID-7).
 * Usar al inicio de toda query o mutation que lea o escriba datos del
 * negocio (clientes, seguimientos). La protección vive aquí, en el backend,
 * no en el guard de rutas de la UI — cualquiera con la URL del deployment
 * podría llamar a estas funciones directamente sin pasar por `/login`.
 *
 * MID-9 (corrección de hallazgo de auditoría M4): no alcanza con que el
 * email del token coincida con `usuarios.email` — también se exige que el
 * `users._id` real detrás del token (`getAuthUserId`, no se parsea
 * `identity.subject` a mano) coincida con `usuarios.authUserId`. Sin esto,
 * borrar una fila de `usuarios` y reaprovisionar el mismo email para otra
 * persona dejaría que un access token viejo (válido hasta 1h por default de
 * `@convex-dev/auth`, stateless) siguiera autorizando como si fuera la
 * persona nueva.
 */
export async function requireUsuario(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) throw new Error("No autenticado.");
  const usuario = await ctx.db
    .query("usuarios")
    .withIndex("by_email", (q) => q.eq("email", identity.email!))
    .unique();
  if (!usuario) throw new Error("No autorizado.");

  const authUserId = await getAuthUserId(ctx);
  if (!authUserId || usuario.authUserId !== authUserId) {
    throw new Error("No autorizado.");
  }

  return usuario;
}

/** MID-9: único control de acceso real para la gestión de equipo — el
 * filtro de `NAV_ITEMS` en el frontend es solo cosmético (oculta el link),
 * nunca la única defensa. */
export async function requirePropietaria(ctx: QueryCtx | MutationCtx) {
  const usuario = await requireUsuario(ctx);
  if (usuario.rol !== "propietaria") throw new Error("No autorizado.");
  return usuario;
}
