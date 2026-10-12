import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default function ClientesPage() {
  return (
    <PantallaPendiente
      titulo="Clientes"
      issue="MID-12"
      descripcion="Lista de clientes con buscador (nombre, teléfono o email) y botón/FAB para dar de alta un cliente nuevo."
    />
  );
}
