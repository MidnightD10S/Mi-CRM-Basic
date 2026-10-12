"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, MessageSquarePlus, TrendingUp, UserPlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OverlayPendiente } from "@/components/ui/overlay-pendiente";
import { useToast } from "@/components/ui/toast";
import { NuevaTareaOverlay } from "./nueva-tarea-overlay";
import { ESTADOS_CLIENTE, estadoClienteOFallback } from "@/lib/constants";
import { formatSeguimientoDueLabel, startOfDay } from "@/lib/format";
import { api, type Doc, type Id } from "@/lib/convex-generated";

type SeguimientoPendiente = {
  _id: Id<"seguimientos">;
  accion: string;
  vence: number;
  clienteId: Id<"clientes">;
  cliente: { nombre: string; estado?: Doc<"clientes">["estado"] } | null;
  responsable: { nombre: string } | null;
};

type AccesoRapido = "nueva-tarea" | "anotar-interaccion" | "registrar-venta" | "nuevo-cliente" | null;

export default function HoyPage() {
  // La sesión ya está garantizada "lista" acá — RequireAuth (en el layout de
  // (app)) no renderiza children hasta que lo esté (ver MID-7).
  const seguimientos = useQuery(api.seguimientos.listarPendientes);
  const marcarHecho = useMutation(api.seguimientos.marcarHecho);
  const deshacerHecho = useMutation(api.seguimientos.deshacerHecho);
  const { show } = useToast();

  const [ocultosOptimistas, setOcultosOptimistas] = useState<Set<Id<"seguimientos">>>(new Set());
  const [accesoAbierto, setAccesoAbierto] = useState<AccesoRapido>(null);

  async function completar(seguimiento: SeguimientoPendiente) {
    setOcultosOptimistas((prev) => new Set(prev).add(seguimiento._id));
    try {
      await marcarHecho({ id: seguimiento._id });
      show("Seguimiento completado", {
        actionLabel: "Deshacer",
        onAction: async () => {
          try {
            await deshacerHecho({ id: seguimiento._id });
          } finally {
            setOcultosOptimistas((prev) => {
              const siguiente = new Set(prev);
              siguiente.delete(seguimiento._id);
              return siguiente;
            });
          }
        },
      });
    } catch {
      setOcultosOptimistas((prev) => {
        const siguiente = new Set(prev);
        siguiente.delete(seguimiento._id);
        return siguiente;
      });
      show("No se pudo completar, intenta de nuevo.");
    }
  }

  if (seguimientos === undefined) {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5">
        <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
      </div>
    );
  }

  const visibles = seguimientos.filter((s) => !ocultosOptimistas.has(s._id));
  const hoyInicio = startOfDay(new Date()).getTime();

  const atrasados = visibles.filter((s) => startOfDay(new Date(s.vence)).getTime() < hoyInicio);
  const paraHoy = visibles.filter((s) => startOfDay(new Date(s.vence)).getTime() === hoyInicio);
  const proximas = visibles.filter((s) => startOfDay(new Date(s.vence)).getTime() > hoyInicio);

  const total = seguimientos.length;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5">
      <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">
        {total === 0 ? "Todo al día" : `${total} seguimientos/tareas pendientes`}
      </h1>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Button
          variant="secondary"
          className="h-auto flex-col gap-1.5 py-3.5 text-[13px]"
          onClick={() => setAccesoAbierto("nueva-tarea")}
        >
          <CalendarCheck size={20} strokeWidth={1.5} />
          Nueva tarea
        </Button>
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
          onClick={() => setAccesoAbierto("registrar-venta")}
        >
          <TrendingUp size={20} strokeWidth={1.5} />
          Registrar venta
        </Button>
        <Button
          variant="secondary"
          className="h-auto flex-col gap-1.5 py-3.5 text-[13px]"
          onClick={() => setAccesoAbierto("nuevo-cliente")}
        >
          <UserPlus2 size={20} strokeWidth={1.5} />
          Nuevo cliente
        </Button>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No hay seguimientos para hoy"
          description="Estás al día. Disfruta del día o añade un nuevo seguimiento."
          action={
            <Button size="compact" onClick={() => setAccesoAbierto("nueva-tarea")}>
              Nueva tarea
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <GrupoSeguimientos titulo="Atrasados" items={atrasados} onCompletar={completar} destacado />
          <GrupoSeguimientos titulo="Para hoy" items={paraHoy} onCompletar={completar} />
          <GrupoSeguimientos titulo="Próximas" items={proximas} onCompletar={completar} />
        </div>
      )}

      <NuevaTareaOverlay
        open={accesoAbierto === "nueva-tarea"}
        onClose={() => setAccesoAbierto(null)}
      />
      <OverlayPendiente
        open={accesoAbierto === "anotar-interaccion"}
        onClose={() => setAccesoAbierto(null)}
        titulo="Anotar interacción"
        issue="MID-16"
        descripcion="Registrar una interacción con un cliente (llamada, email, WhatsApp, en persona) desde un selector de cliente."
      />
      <OverlayPendiente
        open={accesoAbierto === "registrar-venta"}
        onClose={() => setAccesoAbierto(null)}
        titulo="Registrar venta"
        issue="MID-20 / MID-21"
        descripcion="Registrar una venta u oportunidad (concepto, importe, estado) desde un selector de cliente."
      />
      <OverlayPendiente
        open={accesoAbierto === "nuevo-cliente"}
        onClose={() => setAccesoAbierto(null)}
        titulo="Nuevo cliente"
        issue="MID-11"
        descripcion="Alta completa de cliente (nombre, empresa, teléfono, email, canal de origen, nota)."
      />
    </div>
  );
}

function GrupoSeguimientos({
  titulo,
  items,
  onCompletar,
  destacado,
}: {
  titulo: string;
  items: SeguimientoPendiente[];
  onCompletar: (seguimiento: SeguimientoPendiente) => void;
  destacado?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-(--color-text-muted)">{titulo}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <FilaSeguimiento key={item._id} item={item} onCompletar={onCompletar} destacado={destacado} />
        ))}
      </ul>
    </section>
  );
}

function FilaSeguimiento({
  item,
  onCompletar,
  destacado,
}: {
  item: SeguimientoPendiente;
  onCompletar: (seguimiento: SeguimientoPendiente) => void;
  destacado?: boolean;
}) {
  const router = useRouter();
  const estado = estadoClienteOFallback(item.cliente?.estado);
  const estadoInfo = ESTADOS_CLIENTE[estado];

  return (
    <li>
      <Card
        className={destacado ? "border-(--color-error) bg-(--color-error-bg)" : undefined}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label="Marcar como hecho"
            onClick={(e) => {
              e.stopPropagation();
              onCompletar(item);
            }}
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-(--radius-full) border border-(--color-border-strong) text-transparent hover:border-(--color-primary) hover:text-(--color-primary)"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            className="flex min-w-0 flex-1 flex-col gap-1 text-left"
            onClick={() => router.push(`/clientes/${item.clienteId}`)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-medium">{item.cliente?.nombre ?? "Cliente eliminado"}</span>
              <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
            </div>
            <p className="text-[14px] text-(--color-text)">{item.accion}</p>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-(--color-text-subtle)">
              <span>{formatSeguimientoDueLabel(new Date(item.vence))}</span>
              <span>·</span>
              <span>{item.responsable?.nombre ?? "Sin responsable"}</span>
            </div>
          </button>
        </div>
      </Card>
    </li>
  );
}
