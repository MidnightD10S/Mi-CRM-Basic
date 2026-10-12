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
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
        <AppErrorBoundary>
          <RequireAuth>{children}</RequireAuth>
        </AppErrorBoundary>
      </div>
      <TabBar />
    </div>
  );
}
