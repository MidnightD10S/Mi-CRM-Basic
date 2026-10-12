"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useSessionUsuario } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Barra inferior fija, solo móvil (<768px). Ver MID-10/MID-42/MID-7. */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const sesion = useSessionUsuario();
  const rol = sesion.status === "listo" ? sesion.rol : undefined;
  const items = NAV_ITEMS.filter((item) => !item.rolesVisibles || (rol && item.rolesVisibles.includes(rol)));

  async function cerrarSesion() {
    // Mismo criterio que Sidebar: si `signOut()` rechaza, igual se redirige
    // a /login en vez de dejar una promesa sin manejar.
    try {
      await signOut();
    } finally {
      router.push("/login");
    }
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-(--color-border) bg-(--color-surface) md:hidden"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium",
              active ? "text-(--color-primary)" : "text-(--color-text-subtle)"
            )}
          >
            <Icon size={22} strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
      {/* No es un item de NAV_ITEMS (no es una ruta) — es la única forma de
          cerrar sesión disponible en móvil, donde Sidebar no existe. */}
      <button
        type="button"
        aria-label="Cerrar sesión"
        onClick={cerrarSesion}
        className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-(--color-text-subtle)"
      >
        <LogOut size={22} strokeWidth={1.5} />
        Salir
      </button>
    </nav>
  );
}
