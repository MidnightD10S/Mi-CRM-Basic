import { Sidebar } from "@/components/layout/sidebar";
import { TabBar } from "@/components/layout/tab-bar";
import { AppErrorBoundary } from "@/components/providers/app-error-boundary";

/**
 * Shell de la app para las pantallas autenticadas (Hoy, Clientes, Ventas, Equipo,
 * Cuenta). Ver MID-10 (control de acceso aún pendiente) y MID-42 (navegación).
 *
 * `AppErrorBoundary` captura la excepción que lanza `useQuery` de Convex
 * cuando cualquier query de la pantalla falla (sesión, seguimientos, etc.) —
 * sin esto, un fallo de red tumbaría toda la pantalla sin forma de reintentar.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">
        <AppErrorBoundary>{children}</AppErrorBoundary>
      </div>
      <TabBar />
    </div>
  );
}
