import { Sidebar } from "@/components/layout/sidebar";
import { TabBar } from "@/components/layout/tab-bar";
import { AppErrorBoundary } from "@/components/providers/app-error-boundary";
import { RequireAuth } from "@/components/providers/require-auth";

/**
 * Shell de la app para las pantallas autenticadas (Hoy, Clientes, Ventas, Equipo,
 * Cuenta). Ver MID-7 (sesión real), MID-10 y MID-42 (navegación).
 *
 * `AppErrorBoundary` captura la excepción que lanza `useQuery` de Convex
 * cuando cualquier query de la pantalla falla (sesión, seguimientos, etc.) —
 * sin esto, un fallo de red tumbaría toda la pantalla sin forma de reintentar.
 * `RequireAuth` (por dentro) redirige a `/login` sin sesión — mejora de UX,
 * no el control de seguridad real (eso vive en el backend, ver
 * convex/authHelpers.ts).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full">
      <Sidebar />
      {/* MID-24: el scroll ya no vive acá — vive en un div propio dentro de
          cada pantalla (ver su wrapper con <ViewTransition>), acotado a
          `h-full`. Si este contenedor siguiera siendo el que scrollea, el
          elemento que nombramos para la transición (más abajo, dentro de
          `{children}`) crecería a la altura de TODO el contenido en vez de
          a la altura visible, y la instantánea que captura la View
          Transition API se superpondría a la cinta inferior fija. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppErrorBoundary>
          <RequireAuth>{children}</RequireAuth>
        </AppErrorBoundary>
      </div>
      <TabBar />
    </div>
  );
}
