"use client";

import { useState, ViewTransition } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { Plus, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RegistrarVentaOverlay } from "../clientes/registrar-venta-overlay";
import { ESTADOS_VENTA, type EstadoVenta } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { api, type Id } from "@/lib/convex-generated";

type FiltroVenta = "todas" | EstadoVenta;

const FILTROS: { valor: FiltroVenta; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "oportunidad_abierta", etiqueta: "En marcha" },
  { valor: "ganada", etiqueta: "Ganadas" },
  { valor: "perdida", etiqueta: "Perdidas" },
];

export default function VentasPage() {
  // MID-24: cross-fade al cambiar de tab — esta pantalla no recibe push
  // horizontal (nadie navega a ella desde una lista), así que solo necesita
  // `default`.
  return (
    <ViewTransition default="tab-fade">
      {/* `h-full overflow-y-auto`: acota la caja que la View Transition API
          captura a lo que realmente se ve — ver el comentario en
          src/app/(app)/layout.tsx. */}
      <div className="h-full overflow-y-auto pb-16 md:pb-0">
        <VentasPageContent />
      </div>
    </ViewTransition>
  );
}

function VentasPageContent() {
  // `ventas` (lista acotada a LIMITE_LISTADO, ver convex/ventas.ts) es solo
  // para las filas del listado. Las métricas y los contadores de los chips
  // SIEMPRE salen de `resumen` (lectura O(1) del resumen incremental), nunca
  // de `ventas` — así no muestran un total parcial como si fuera el real.
  const ventas = useQuery(api.ventas.listarTodas);
  const resumen = useQuery(api.ventas.resumen);
  const [filtro, setFiltro] = useState<FiltroVenta>("todas");
  const [altaAbierta, setAltaAbierta] = useState(false);
  // MID-24: igual que en Hoy/Ficha de cliente — el contador solo avanza al
  // abrir, nunca al cerrar, para que el `key` no desmonte el overlay a
  // mitad de su animación de cierre.
  const [altaKey, setAltaKey] = useState(0);

  function abrirAlta() {
    setAltaKey((k) => k + 1);
    setAltaAbierta(true);
  }

  const cargando = ventas === undefined || resumen === undefined;

  if (cargando) {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5 pb-24">
        <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
      </div>
    );
  }

  if (resumen.totalVentas === 0) {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5 pb-24">
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">
          Ventas y oportunidades
        </h1>
        <EmptyState
          icon={TrendingUp}
          title="Sin ventas registradas todavía"
          description="Añadí la primera venta u oportunidad de un cliente para empezar a llevar el control."
          action={
            <Button size="compact" onClick={abrirAlta}>
              Añadir venta
            </Button>
          }
        />
        <RegistrarVentaOverlay
          key={altaKey}
          open={altaAbierta}
          onClose={() => setAltaAbierta(false)}
        />
      </div>
    );
  }

  const ventasFiltradas =
    filtro === "todas" ? ventas : ventas.filter((venta) => venta.estado === filtro);
  const listaAcotada = resumen.totalVentas > ventas.length;

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">
          Ventas y oportunidades
        </h1>
        <Button
          variant="primary"
          size="compact"
          className="hidden md:flex"
          onClick={abrirAlta}
        >
          <Plus size={16} strokeWidth={2} />
          Añadir venta
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-(--color-text-subtle)">En marcha</span>
          <span className="text-xl font-semibold tracking-[var(--tracking-tight)]">
            {formatCurrency(resumen.enMarcha.suma)}
          </span>
          <span className="text-[13px] text-(--color-text-subtle)">
            {resumen.enMarcha.cantidad} oportunidad{resumen.enMarcha.cantidad === 1 ? "" : "es"}
          </span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-(--color-text-subtle)">Ganado</span>
          <span className="text-xl font-semibold tracking-[var(--tracking-tight)]">
            {formatCurrency(resumen.ganadas.suma)}
          </span>
          <span className="text-[13px] text-(--color-text-subtle)">
            {resumen.ganadas.cantidad} venta{resumen.ganadas.cantidad === 1 ? "" : "s"}
          </span>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Button
            key={f.valor}
            variant={filtro === f.valor ? "primary" : "secondary"}
            size="compact"
            onClick={() => setFiltro(f.valor)}
          >
            {f.etiqueta} ({contadorDe(f.valor, resumen)})
          </Button>
        ))}
      </div>

      {ventasFiltradas.length === 0 ? (
        <Card>
          <p className="text-[14px] text-(--color-text-subtle)">
            No hay ventas con este estado.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {ventasFiltradas.map((venta) => (
            <FilaVenta key={venta._id} venta={venta} />
          ))}
        </ul>
      )}

      {listaAcotada && (
        <p className="text-[13px] text-(--color-text-subtle)">
          Mostrando las {ventas.length} ventas más recientes. Las métricas de arriba sí incluyen
          todo el negocio.
        </p>
      )}

      <button
        type="button"
        aria-label="Añadir venta"
        onClick={abrirAlta}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-(--radius-full) bg-(--color-primary) text-(--color-on-primary) shadow-[var(--shadow-lg)] md:hidden"
      >
        <Plus size={24} strokeWidth={2} />
      </button>

      <RegistrarVentaOverlay
        key={altaKey}
        open={altaAbierta}
        onClose={() => setAltaAbierta(false)}
      />
    </div>
  );
}

function contadorDe(
  filtro: FiltroVenta,
  resumen: {
    totalVentas: number;
    enMarcha: { cantidad: number };
    ganadas: { cantidad: number };
    perdidas: { cantidad: number };
  }
): number {
  switch (filtro) {
    case "todas":
      return resumen.totalVentas;
    case "oportunidad_abierta":
      return resumen.enMarcha.cantidad;
    case "ganada":
      return resumen.ganadas.cantidad;
    case "perdida":
      return resumen.perdidas.cantidad;
  }
}

function FilaVenta({
  venta,
}: {
  venta: {
    _id: string;
    concepto: string;
    importe: number;
    estado: EstadoVenta;
    fecha: number;
    clienteId: Id<"clientes">;
    cliente: { nombre: string } | null;
  };
}) {
  const estadoInfo = ESTADOS_VENTA[venta.estado];

  const contenido = (
    <Card className="flex flex-col gap-1.5 transition-colors hover:bg-(--color-surface-2)">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-medium">{venta.cliente?.nombre ?? "Cliente eliminado"}</span>
        <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
      </div>
      <p className="text-[14px] text-(--color-text)">{venta.concepto}</p>
      <span className="text-[13px] text-(--color-text-subtle)">
        {formatCurrency(venta.importe)}
      </span>
    </Card>
  );

  // Sin Link si el cliente fue eliminado: no tiene sentido navegar a una
  // ficha que ya no existe (hallazgo de auditoría).
  return (
    <li>
      {venta.cliente ? (
        <Link href={`/clientes/${venta.clienteId}`} className="block">
          {contenido}
        </Link>
      ) : (
        contenido
      )}
    </li>
  );
}
