import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function RecuperarContrasenaPage() {
  return (
    <PantallaPendiente
      titulo="Recuperar contraseña"
      issue="MID-44"
      descripcion="Pide el email y envía un enlace de restablecimiento si corresponde a un usuario existente (mensaje de confirmación neutro)."
    />
  );
}
