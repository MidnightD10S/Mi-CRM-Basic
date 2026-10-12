"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

/** Barra inferior fija, solo móvil (<768px). Ver MID-10/MID-42. */
export function TabBar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const items = NAV_ITEMS.filter((item) => !item.rolesVisibles || item.rolesVisibles.includes(user.rol));

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
    </nav>
  );
}
