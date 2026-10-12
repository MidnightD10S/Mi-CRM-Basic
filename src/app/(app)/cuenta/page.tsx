import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function CuentaPage() {
  return (
    <PantallaPendiente
      titulo="Mi cuenta"
      issue="MID-8"
      descripcion="Perfil del usuario con sesión iniciada: editar mis datos, cambiar contraseña y cerrar sesión."
    />
  );
}
