"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Avatar } from "@/components/ui/avatar";
import { ROLES } from "@/lib/constants";
import { useSessionUsuario } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Barra lateral fija, solo escritorio (>=768px). Ver MID-10/MID-42/MID-7. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const sesion = useSessionUsuario();
  const nombre = sesion.status === "listo" ? sesion.nombre : "";
  const rol = sesion.status === "listo" ? sesion.rol : undefined;
  const items = NAV_ITEMS.filter((item) => !item.rolesVisibles || (rol && item.rolesVisibles.includes(rol)));

  async function cerrarSesion() {
    // Si `signOut()` rechaza (p. ej. fallo de red), igual se redirige a
    // /login en vez de dejar una promesa sin manejar y a la persona varada
    // en la pantalla actual sin saber por qué el botón no hizo nada.
    try {
      await signOut();
    } finally {
      router.push("/login");
    }
  }

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col gap-1 border-r border-(--color-border) bg-(--color-surface) p-3.5 md:flex">
      <div className="flex items-center gap-2.5 px-3 pb-5 pt-1.5">
        <span className="flex h-6.5 w-6.5 items-center justify-center rounded-[7px] bg-(--color-primary) text-sm font-semibold text-(--color-on-primary)">
          V
        </span>
        <span className="text-base font-semibold tracking-[var(--tracking-tight)]">Vibe CRM</span>
      </div>

      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-(--radius-md) px-3 py-2.5 text-[14px] font-medium",
              active
                ? "bg-(--color-primary-subtle) text-(--color-primary)"
                : "text-(--color-text-muted) hover:bg-(--color-surface-2)"
            )}
          >
            <Icon size={20} strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 border-t border-(--color-border) pt-3">
        <Link
          href="/cuenta"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-(--radius-md) p-1.5 hover:bg-(--color-surface-2)"
        >
          <Avatar nombre={nombre} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium">{nombre}</span>
            <span className="text-xs text-(--color-text-subtle)">{rol ? ROLES[rol] : ""}</span>
          </div>
        </Link>
        <button
          type="button"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          onClick={cerrarSesion}
          className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-(--radius-md) text-(--color-text-subtle) hover:bg-(--color-surface-2)"
        >
          <LogOut size={18} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}
