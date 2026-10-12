import type { Rol } from "@/lib/constants";

export interface SessionUser {
  id: string;
  nombre: string;
  rol: Rol;
}

/**
 * TODO(MID-6, MID-7, MID-10, MID-44): placeholder mientras no existe autenticación
 * real con Convex. Sustituir por la sesión real (login, persistencia, control de
 * acceso por rol) antes de construir cualquier pantalla que dependa de permisos.
 */
export function useCurrentUser(): SessionUser {
  return { id: "mock-user", nombre: "Emiliana", rol: "propietaria" };
}
