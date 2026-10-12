import { Sidebar } from "@/components/layout/sidebar";
import { TabBar } from "@/components/layout/tab-bar";

/**
 * Shell de la app para las pantallas autenticadas (Hoy, Clientes, Ventas, Equipo,
 * Cuenta). Ver MID-10 (control de acceso aún pendiente) y MID-42 (navegación).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-16 md:pb-0">{children}</div>
      <TabBar />
    </div>
  );
}
