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
import { ProgramarSeguimientoOverlay } from "./programar-seguimiento-overlay";
import { AnotarInteraccionOverlay } from "../anotar-interaccion-overlay";
import {
  CANALES_ORIGEN,
  ESTADOS_CLIENTE,
  ICONOS_CANAL_INTERACCION,
  estadoClienteOFallback,
  type CanalInteraccion,
} from "@/lib/constants";
import { startOfDay } from "@/lib/format";
import { api, type Id } from "@/lib/convex-generated";

type AccesoRapido = "anotar-interaccion" | "programar-seguimiento" | "registrar-venta" | null;

export default function FichaClientePage() {
  const params = useParams<{ id: string }>();
  const clienteId = params.id as Id<"clientes">;

  const cliente = useQuery(api.clientes.obtener, { id: clienteId });
  const seguimientos = useQuery(api.seguimientos.listarPendientesPorCliente, { clienteId });
  const historial = useQuery(api.interacciones.listarPorCliente, { clienteId });

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
  // Igual que en Hoy (MID-18): comparar por inicio de día local, no por el
  // timestamp crudo — un seguimiento que vence hoy no debe verse "Atrasado"
  // solo porque ya pasó la hora exacta en que se creó.
  const hoyInicio = startOfDay(new Date()).getTime();

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
                atrasado={startOfDay(new Date(seguimiento.vence)).getTime() < hoyInicio}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Historial cronológico (MID-19): la parte de interacciones ya está
          montada (MID-14/MID-16); solo falta la parte de ventas (Fase 4,
          MID-20/MID-21) — hasta entonces, el estado vacío solo aparece si no
          hay ninguna interacción registrada. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-(--color-text-muted)">Historial</h2>
        {historial === undefined ? (
          <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
        ) : historial.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Sin actividad todavía"
            description="Las interacciones y ventas que se registren con este cliente aparecerán aquí."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {historial.map((interaccion) => (
              <FilaInteraccion key={interaccion._id} interaccion={interaccion} />
            ))}
          </ul>
        )}
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

      <AnotarInteraccionOverlay
        key={accesoAbierto === "anotar-interaccion" ? "abierto" : "cerrado"}
        open={accesoAbierto === "anotar-interaccion"}
        onClose={() => setAccesoAbierto(null)}
        clientePreseleccionado={{ id: clienteId, nombre: cliente.nombre }}
      />
      <ProgramarSeguimientoOverlay
        key={accesoAbierto === "programar-seguimiento" ? "abierto" : "cerrado"}
        open={accesoAbierto === "programar-seguimiento"}
        onClose={() => setAccesoAbierto(null)}
        clienteId={clienteId}
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

/**
 * MID-19: copy exacto "ícono según canal + nota + 'Registrado por [autor]'".
 */
function FilaInteraccion({
  interaccion,
}: {
  interaccion: {
    _id: string;
    tipo: CanalInteraccion;
    nota: string;
    fecha: number;
    autor: { nombre: string } | null;
  };
}) {
  const Icono = ICONOS_CANAL_INTERACCION[interaccion.tipo];
  return (
    <li>
      <Card className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[13px] text-(--color-text-subtle)">
          <Icono size={15} strokeWidth={1.5} />
          <span>{new Date(interaccion.fecha).toLocaleDateString("es-ES")}</span>
        </div>
        <p className="text-[14px] text-(--color-text)">{interaccion.nota}</p>
        <p className="text-[13px] text-(--color-text-subtle)">
          Registrado por {interaccion.autor?.nombre ?? "Autor no disponible"}
        </p>
      </Card>
    </li>
  );
}
