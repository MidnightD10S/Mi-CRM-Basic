"use client";

import { useState, ViewTransition } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { NuevoClienteOverlay } from "./nuevo-cliente-overlay";
import { ESTADOS_CLIENTE, estadoClienteOFallback } from "@/lib/constants";
import { api } from "@/lib/convex-generated";

export default function ClientesPage() {
  const [busqueda, setBusqueda] = useState("");
  const [altaAbierta, setAltaAbierta] = useState(false);
  const clientes = useQuery(api.clientes.listar, { texto: busqueda });

  const cargando = clientes === undefined;
  const sinClientes = !cargando && busqueda.trim() === "" && clientes.length === 0;
  const sinResultados = !cargando && busqueda.trim() !== "" && clientes.length === 0;

  return (
    // MID-24: cross-fade al cambiar de tab (`default`) y push horizontal al
    // entrar a una Ficha (`enter`/`exit`, parejas con el mismo mapa en
    // clientes/[id]/page.tsx — ver globals.css para las clases reales).
    <ViewTransition
      default="tab-fade"
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "tab-fade" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "tab-fade" }}
    >
    {/* El scroll vive en este div, a todo el ancho — no en el div de abajo
        que centra el contenido (`mx-auto max-w-[860px]`). Si `overflow-y-auto`
        viviera en el mismo div centrado, la barra de desplazamiento sale al
        borde de esa caja angosta (se ve "centrada" en vez de pegada al
        borde real de la pantalla). También acota la caja que la View
        Transition API captura a lo que realmente se ve — ver el comentario
        en src/app/(app)/layout.tsx. */}
    <div className="h-full overflow-y-auto">
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">Clientes</h1>
        <Button
          variant="primary"
          size="compact"
          className="hidden md:flex"
          onClick={() => setAltaAbierta(true)}
        >
          <Plus size={16} strokeWidth={2} />
          Nuevo cliente
        </Button>
      </div>

      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-subtle)"
        />
        <Input
          placeholder="Buscar por nombre, teléfono o email…"
          className="pl-10"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {cargando && (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Card className="flex flex-col gap-2">
                <div className="h-4 w-1/3 animate-pulse rounded-(--radius-sm) bg-(--color-surface-2)" />
                <div className="h-3 w-1/5 animate-pulse rounded-(--radius-sm) bg-(--color-surface-2)" />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {sinClientes && (
        <EmptyState
          icon={Users}
          title="Todavía no hay clientes"
          description="Agrega tu primer cliente para empezar a darle seguimiento."
          action={
            <Button size="compact" onClick={() => setAltaAbierta(true)}>
              Añadir cliente
            </Button>
          }
        />
      )}

      {sinResultados && (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          description="No hay clientes que coincidan con tu búsqueda."
          action={
            <Button variant="secondary" size="compact" onClick={() => setBusqueda("")}>
              Limpiar búsqueda
            </Button>
          }
        />
      )}

      {!cargando && clientes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {clientes.map((cliente) => (
            <FilaCliente key={cliente._id} cliente={cliente} />
          ))}
        </ul>
      )}

      <button
        type="button"
        aria-label="Nuevo cliente"
        onClick={() => setAltaAbierta(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-(--radius-full) bg-(--color-primary) text-(--color-on-primary) shadow-[var(--shadow-lg)] md:hidden"
      >
        <Plus size={24} strokeWidth={2} />
      </button>

      <NuevoClienteOverlay open={altaAbierta} onClose={() => setAltaAbierta(false)} />
    </div>
    </div>
    </ViewTransition>
  );
}

function FilaCliente({
  cliente,
}: {
  cliente: { _id: string; nombre: string; estado?: "nuevo_lead" | "en_negociacion" | "ganado" | "perdido"; creadoEn: number };
}) {
  const estado = estadoClienteOFallback(cliente.estado);
  const estadoInfo = ESTADOS_CLIENTE[estado];

  return (
    <li>
      {/* Link (no button+div): es una navegación real, no una acción — permite
          abrir en pestaña nueva, Ctrl/Cmd-click, etc. `?from=clientes` +
          `transitionTypes` (MID-24): el botón "atrás" de la Ficha usa el
          origen para volver aquí, con el push horizontal animado. */}
      <Link
        href={`/clientes/${cliente._id}?from=clientes`}
        transitionTypes={["nav-forward"]}
        className="block"
      >
        <Card className="flex flex-col gap-1.5 transition-colors hover:bg-(--color-surface-2)">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium">{cliente.nombre}</span>
            <Badge tone={estadoInfo.tone}>{estadoInfo.label}</Badge>
          </div>
          {/* "Cliente desde" usa la fecha de alta, no la de último contacto —
              todavía no existen interacciones registradas (MID-16 pendiente).
              Cuando exista, este dato se reemplaza por el último contacto real. */}
          <span className="text-[13px] text-(--color-text-subtle)">
            Cliente desde {new Date(cliente.creadoEn).toLocaleDateString("es-ES")}
          </span>
        </Card>
      </Link>
    </li>
  );
}
