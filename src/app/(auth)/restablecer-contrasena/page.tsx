import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function RestablecerContrasenaPage() {
  return (
    <PantallaPendiente
      titulo="Restablecer contraseña"
      issue="MID-44"
      descripcion="Se llega desde el enlace del email (con token). Nueva contraseña + repetir, mínimo 6 caracteres."
    />
  );
}
