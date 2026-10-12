import { useQuery, useConvexAuth } from "convex/react";
import { api, type Id } from "@/lib/convex-generated";
import type { Rol } from "@/lib/constants";

/**
 * MID-7: sesión real con Convex Auth. `useConvexAuth` distingue "todavía
 * cargando" de "no hay sesión" (a diferencia de `useQuery`, que solo
 * devuelve `undefined`/valor) — por eso se combina con `usuarios.yo()` para
 * resolver también nombre/rol, en vez de leerlos de un email fijo como antes.
 */
export type SessionState =
  | { status: "cargando" }
  | { status: "sin_sesion" }
  | { status: "listo"; usuarioId: Id<"usuarios">; nombre: string; rol: Rol }
  | { status: "no_encontrado" }; // autenticado pero sin fila en `usuarios`

export function useSessionUsuario(): SessionState {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const usuario = useQuery(api.usuarios.yo, isAuthenticated ? {} : "skip");

  if (isLoading) return { status: "cargando" };
  if (!isAuthenticated) return { status: "sin_sesion" };
  if (usuario === undefined) return { status: "cargando" };
  if (usuario === null) return { status: "no_encontrado" };
  return { status: "listo", usuarioId: usuario._id, nombre: usuario.nombre, rol: usuario.rol };
}
