"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, MessageSquarePlus, TrendingUp, UserPlus2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { NuevaTareaOverlay } from "./nueva-tarea-overlay";
import { NuevoClienteOverlay } from "../clientes/nuevo-cliente-overlay";
import { AnotarInteraccionOverlay } from "../clientes/anotar-interaccion-overlay";
import { RegistrarVentaOverlay } from "../clientes/registrar-venta-overlay";
import {
  ESTADOS_CLIENTE,
  ICONOS_CANAL_INTERACCION,
  estadoClienteOFallback,
  type CanalInteraccion,
} from "@/lib/constants";
import { formatRelativePast, formatSeguimientoDueLabel, startOfDay } from "@/lib/format";
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
  const pendientes = useQuery(api.seguimientos.listarPendientes);
  const recientes = useQuery(api.interacciones.listarRecientes);
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

  if (pendientes === undefined) {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5">
        <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
      </div>
    );
  }

  const seguimientos = pendientes.items;
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
          {pendientes.truncado && (
            <p className="text-[13px] text-(--color-text-subtle)">
              Mostrando los {seguimientos.length} seguimientos más próximos a vencer. Hay más
              pendientes además de estos — completa algunos para ver el resto.
            </p>
          )}
        </div>
      )}

      {/* Actividad reciente: feed de interacciones de todo el negocio (no
          solo las propias), mismo criterio que los seguimientos pendientes
          de arriba (MID-18) — pedido explícito del usuario al definir el
          alcance de MID-16 en Hoy. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-(--color-text-muted)">Actividad reciente</h2>
        {recientes === undefined ? (
          <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
        ) : recientes.length === 0 ? (
          <Card>
            <p className="text-[14px] text-(--color-text-subtle)">
              Todavía no hay interacciones registradas.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {recientes.map((interaccion) => (
              <FilaInteraccionReciente key={interaccion._id} interaccion={interaccion} />
            ))}
          </ul>
        )}
      </section>

      <NuevaTareaOverlay
        open={accesoAbierto === "nueva-tarea"}
        onClose={() => setAccesoAbierto(null)}
      />
      <AnotarInteraccionOverlay
        key={`anotar-interaccion-${accesoAbierto === "anotar-interaccion" ? "abierto" : "cerrado"}`}
        open={accesoAbierto === "anotar-interaccion"}
        onClose={() => setAccesoAbierto(null)}
      />
      <RegistrarVentaOverlay
        key={`registrar-venta-${accesoAbierto === "registrar-venta" ? "abierto" : "cerrado"}`}
        open={accesoAbierto === "registrar-venta"}
        onClose={() => setAccesoAbierto(null)}
      />
      {/* MID-11 ya está construido (ver src/app/(app)/clientes/nuevo-cliente-overlay.tsx)
          — este acceso rápido había quedado apuntando al aviso de "pantalla
          pendiente" en vez del formulario real; se corrige reutilizando el
          mismo overlay que usa la pantalla Clientes. */}
      <NuevoClienteOverlay
        open={accesoAbierto === "nuevo-cliente"}
        onClose={() => setAccesoAbierto(null)}
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

function FilaInteraccionReciente({
  interaccion,
}: {
  interaccion: {
    _id: string;
    tipo: CanalInteraccion;
    nota: string;
    fecha: number;
    clienteId: Id<"clientes">;
    cliente: { nombre: string } | null;
    autor: { nombre: string } | null;
  };
}) {
  const router = useRouter();
  const Icono = ICONOS_CANAL_INTERACCION[interaccion.tipo];

  return (
    <li>
      <Card>
        <button
          type="button"
          className="flex w-full flex-col gap-1 text-left"
          onClick={() => router.push(`/clientes/${interaccion.clienteId}`)}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Icono size={15} strokeWidth={1.5} className="text-(--color-text-subtle)" />
            <span className="text-[15px] font-medium">
              {interaccion.cliente?.nombre ?? "Cliente eliminado"}
            </span>
          </div>
          <p className="truncate text-[14px] text-(--color-text)">{interaccion.nota}</p>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-(--color-text-subtle)">
            <span>{interaccion.autor?.nombre ?? "Autor no disponible"}</span>
            <span>·</span>
            <span>{formatRelativePast(new Date(interaccion.fecha))}</span>
          </div>
        </button>
      </Card>
    </li>
  );
}
