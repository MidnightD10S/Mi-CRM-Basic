"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  Building2,
  CalendarClock,
  Clock,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OverlayPendiente } from "@/components/ui/overlay-pendiente";
import { EditarClienteOverlay } from "./editar-cliente-overlay";
import { CANALES_ORIGEN, ESTADOS_CLIENTE, estadoClienteOFallback } from "@/lib/constants";
import { api, type Id } from "@/lib/convex-generated";

type AccesoRapido = "anotar-interaccion" | "programar-seguimiento" | "registrar-venta" | null;

export default function FichaClientePage() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id as Id<"clientes">;

  const cliente = useQuery(api.clientes.obtener, { id: clienteId });
  const seguimientos = useQuery(api.seguimientos.listarPendientesPorCliente, { clienteId });

  const [editando, setEditando] = useState(false);
  const [accesoAbierto, setAccesoAbierto] = useState<AccesoRapido>(null);

  if (cliente === undefined) {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 p-5">
        <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
      </div>
    );
  }

  if (cliente === null) {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 p-5">
        <EmptyState
          icon={Building2}
          title="Cliente no encontrado"
          description="Puede que haya sido eliminado o que el enlace esté mal escrito."
        />
      </div>
    );
  }

  const estado = estadoClienteOFallback(cliente.estado);
  const estadoInfo = ESTADOS_CLIENTE[estado];
  const ahora = new Date().getTime();

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">{cliente.nombre}</h1>
            <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
          </div>
          {cliente.empresa && (
            <span className="flex items-center gap-1.5 text-[14px] text-(--color-text-muted)">
              <Building2 size={15} strokeWidth={1.5} />
              {cliente.empresa}
            </span>
          )}
        </div>
        <Button variant="secondary" size="compact" onClick={() => setEditando(true)}>
          <Pencil size={16} strokeWidth={1.5} />
          Editar
        </Button>
      </div>

      <Card className="flex flex-col gap-3">
        {cliente.telefono ? (
          <a
            href={`tel:${cliente.telefono}`}
            className="flex items-center gap-2.5 text-[15px] text-(--color-text) hover:text-(--color-primary)"
          >
            <Phone size={17} strokeWidth={1.5} className="text-(--color-text-subtle)" />
            {cliente.telefono}
          </a>
        ) : (
          <span className="flex items-center gap-2.5 text-[15px] text-(--color-text-subtle)">
            <Phone size={17} strokeWidth={1.5} />
            Sin teléfono
          </span>
        )}
        {cliente.email ? (
          <a
            href={`mailto:${cliente.email}`}
            className="flex items-center gap-2.5 text-[15px] text-(--color-text) hover:text-(--color-primary)"
          >
            <Mail size={17} strokeWidth={1.5} className="text-(--color-text-subtle)" />
            {cliente.email}
          </a>
        ) : (
          <span className="flex items-center gap-2.5 text-[15px] text-(--color-text-subtle)">
            <Mail size={17} strokeWidth={1.5} />
            Sin email
          </span>
        )}
        {cliente.canalOrigen && (
          <span className="flex items-center gap-2.5 text-[14px] text-(--color-text-muted)">
            Canal de origen: {CANALES_ORIGEN[cliente.canalOrigen]}
          </span>
        )}
        {cliente.nota && (
          <p className="border-t border-(--color-border) pt-3 text-[14px] text-(--color-text-muted)">
            {cliente.nota}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <Button
          variant="secondary"
          className="h-auto flex-col gap-1.5 py-3.5 text-[13px]"
          onClick={() => setAccesoAbierto("anotar-interaccion")}
        >
          <MessageSquarePlus size={20} strokeWidth={1.5} />
          Anotar interacción
        </Button>
        <Button
          variant="secondary"
          className="h-auto flex-col gap-1.5 py-3.5 text-[13px]"
          onClick={() => setAccesoAbierto("programar-seguimiento")}
        >
          <CalendarClock size={20} strokeWidth={1.5} />
          Programar seguimiento
        </Button>
        <Button
          variant="secondary"
          className="h-auto flex-col gap-1.5 py-3.5 text-[13px]"
          onClick={() => setAccesoAbierto("registrar-venta")}
        >
          <TrendingUp size={20} strokeWidth={1.5} />
          Registrar venta
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-(--color-text-muted)">Seguimientos pendientes</h2>
        {seguimientos === undefined ? (
          <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
        ) : seguimientos.length === 0 ? (
          <Card>
            <p className="text-[14px] text-(--color-text-subtle)">Sin seguimientos pendientes.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {seguimientos.map((seguimiento) => (
              <FilaSeguimientoCliente
                key={seguimiento._id}
                seguimiento={seguimiento}
                atrasado={seguimiento.vence < ahora}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Historial cronológico (MID-19): depende de que existan interacciones
          (MID-14/MID-16) y ventas (MID-20/MID-21), ninguna construida todavía
          — hasta entonces, esta sección siempre muestra el estado vacío
          documentado en el issue, nunca una lista real. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-(--color-text-muted)">Historial</h2>
        <EmptyState
          icon={Clock}
          title="Sin actividad todavía"
          description="Las interacciones y ventas que se registren con este cliente aparecerán aquí."
        />
      </section>

      {/* `key` fuerza un remount cada vez que se abre: así el formulario
          siempre arranca con los datos vigentes del cliente, sin necesitar
          un efecto que sincronice estado (ver comentario del overlay). */}
      <EditarClienteOverlay
        key={editando ? "abierto" : "cerrado"}
        open={editando}
        onClose={() => setEditando(false)}
        cliente={cliente}
      />

      <OverlayPendiente
        open={accesoAbierto === "anotar-interaccion"}
        onClose={() => setAccesoAbierto(null)}
        titulo="Anotar interacción"
        issue="MID-16"
        descripcion="Registrar una interacción con este cliente (llamada, email, WhatsApp, en persona)."
      />
      <OverlayPendiente
        open={accesoAbierto === "programar-seguimiento"}
        onClose={() => setAccesoAbierto(null)}
        titulo="Programar seguimiento"
        issue="MID-17"
        descripcion="Programar un seguimiento para este cliente, con posibilidad de reasignar el responsable."
      />
      <OverlayPendiente
        open={accesoAbierto === "registrar-venta"}
        onClose={() => setAccesoAbierto(null)}
        titulo="Registrar venta"
        issue="MID-20 / MID-21"
        descripcion="Registrar una venta u oportunidad (concepto, importe, estado) para este cliente."
      />
    </div>
  );
}

function FilaSeguimientoCliente({
  seguimiento,
  atrasado,
}: {
  seguimiento: { _id: string; accion: string; vence: number; responsable: { nombre: string } | null };
  atrasado: boolean;
}) {
  return (
    <li>
      <Card className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={atrasado ? "error" : "warning"}>{atrasado ? "Atrasado" : "Pendiente"}</Badge>
        </div>
        <p className="text-[14px] text-(--color-text)">{seguimiento.accion}</p>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-(--color-text-subtle)">
          <span>{new Date(seguimiento.vence).toLocaleDateString("es-ES")}</span>
          <span>·</span>
          <span>{seguimiento.responsable?.nombre ?? "Sin responsable"}</span>
        </div>
      </Card>
    </li>
  );
}
