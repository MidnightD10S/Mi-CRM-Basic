import { CalendarCheck, Users, TrendingUp, UserCog, type LucideIcon } from "lucide-react";
import type { Rol } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Si se define, el item solo se muestra para estos roles (MID-10). */
  rolesVisibles?: Rol[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/hoy", label: "Hoy", icon: CalendarCheck },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/equipo", label: "Equipo", icon: UserCog, rolesVisibles: ["propietaria"] },
];
