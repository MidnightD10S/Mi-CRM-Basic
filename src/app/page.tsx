import { redirect } from "next/navigation";

/**
 * TODO(MID-10): cuando exista control de acceso real, redirigir a /login si no
 * hay sesión. Por ahora siempre abre en /hoy, como indica el PRD.
 */
export default function RootPage() {
  redirect("/hoy");
}
