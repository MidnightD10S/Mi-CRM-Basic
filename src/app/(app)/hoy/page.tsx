import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function HoyPage() {
  return (
    <PantallaPendiente
      titulo="Hoy"
      issue="MID-18"
      descripcion="Tareas del día: seguimientos agrupados en Atrasados / Para hoy / Próximas, con accesos rápidos a Nueva tarea, Anotar interacción, Registrar venta y Nuevo cliente."
    />
  );
}
