import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function LoginPage() {
  return (
    <PantallaPendiente
      titulo="Inicio de sesión"
      issue="MID-7"
      descripcion="Formulario de email + contraseña, mostrar/ocultar contraseña, enlace a recuperar contraseña y mensajes de error de acceso."
    />
  );
}
