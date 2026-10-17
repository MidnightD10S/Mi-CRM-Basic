import { ViewTransition } from "react";
import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function CuentaPage() {
  return (
    // MID-24: cross-fade al entrar/salir, igual que las demás pantallas
    // (incluida Equipo, el mismo placeholder `PantallaPendiente`) — Cuenta
    // no es un tab de la barra, se llega acá desde el avatar, pero participa
    // de la misma navegación.
    <ViewTransition default="tab-fade">
      <PantallaPendiente
        titulo="Mi cuenta"
        issue="MID-8"
        descripcion="Perfil del usuario con sesión iniciada: editar mis datos, cambiar contraseña y cerrar sesión."
      />
    </ViewTransition>
  );
}
