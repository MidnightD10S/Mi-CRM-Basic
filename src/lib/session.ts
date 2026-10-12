import { useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-generated";
import type { Rol } from "@/lib/constants";

export interface SessionUser {
  id: string;
  nombre: string;
  rol: Rol;
}

/**
 * TODO(MID-6, MID-7, MID-10, MID-44): placeholder mientras no existe autenticación
 * real con Convex. nombre/rol son fijos y síncronos (no dependen de la red), por
 * lo que Sidebar/TabBar se siguen viendo igual aunque la sesión real (abajo)
 * todavía esté cargando. Sustituir por la sesión real (login, persistencia,
 * control de acceso por rol) antes de construir cualquier pantalla que dependa
 * de permisos.
 */
export function useCurrentUser(): SessionUser {
  return { id: "mock-user", nombre: "Emiliana", rol: "propietaria" };
}

/** Email fijo del usuario simulado — debe existir en el seed de convex/usuarios.ts. */
const EMAIL_USUARIO_ACTUAL = "emiliana@vibe-crm.local";

export type SessionState =
  | { status: "cargando" }
  | { status: "listo"; usuarioId: Id<"usuarios">; nombre: string; rol: Rol }
  | { status: "no_encontrado" };

/**
 * Resuelve el usuario simulado contra una fila real de Convex, necesaria porque
 * `seguimientos.responsableId` exige un `Id<"usuarios">` real (no el string
 * inventado de `useCurrentUser`). Úsalo solo en flujos que escriben en Convex
 * (crear tarea, marcar hecho); la navegación (Sidebar/TabBar) no lo necesita.
 *
 * `useQuery` no distingue "cargando" de "falló": devuelve `undefined` mientras
 * carga y **lanza** si la query falla. Por eso esta función no intenta
 * representar un estado "error" — quien la use debe estar envuelto en un
 * `ErrorBoundary` (ver src/components/providers/error-boundary.tsx) que capture
 * esa excepción y ofrezca reintentar.
 */
export function useSessionUsuario(): SessionState {
  const usuario = useQuery(api.usuarios.obtenerPorEmail, { email: EMAIL_USUARIO_ACTUAL });

  if (usuario === undefined) return { status: "cargando" };
  if (usuario === null) return { status: "no_encontrado" };
  return { status: "listo", usuarioId: usuario._id, nombre: usuario.nombre, rol: usuario.rol };
}
