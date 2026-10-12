import { PantallaPendiente } from "@/components/layout/pantalla-pendiente";

export default async function FichaClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PantallaPendiente
      titulo={`Ficha de cliente (${id})`}
      issue="MID-13 / MID-19"
      descripcion="Datos de contacto, acciones rápidas (anotar interacción, programar seguimiento, registrar venta), seguimientos pendientes e historial cronológico."
    />
  );
}
