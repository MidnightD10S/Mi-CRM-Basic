import { ViewTransition } from "react";
import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function EquipoPage() {
  return (
    // MID-24: cross-fade al cambiar de tab (ver globals.css, .tab-fade).
    // `PantallaPendiente` ya trae su propio `h-full overflow-y-auto` (ver
    // su comentario) — no hace falta envolverla en otro div.
    <ViewTransition default="tab-fade">
      <PantallaPendiente
        titulo="Equipo"
        issue="MID-9"
        descripcion="Gestión de usuarios, solo para el rol Dueña: alta, edición y borrado de personas del negocio, con sus reglas de protección."
      />
    </ViewTransition>
  );
}
