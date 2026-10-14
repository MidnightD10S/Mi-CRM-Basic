"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Search, UserPlus } from "lucide-react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CANALES_INTERACCION, type CanalInteraccion } from "@/lib/constants";
import { api, type Id } from "@/lib/convex-generated";

interface AnotarInteraccionOverlayProps {
  open: boolean;
  onClose: () => void;
  clientePreseleccionado?: { id: Id<"clientes">; nombre: string };
}

interface ClienteSeleccionado {
  id: Id<"clientes">;
  nombre: string;
}

const selectClass =
  "h-12 rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 text-[15px] text-(--color-text) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]";

const textareaClass =
  "min-h-20 resize-none rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 py-2.5 text-[15px] text-(--color-text) placeholder:text-(--color-text-subtle) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]";

/**
 * MID-16: un solo formulario de "Anotar interacción" (canal + nota), usado
 * tanto desde la Ficha de cliente (con `clientePreseleccionado`, sin
 * selector) como desde Tareas del día (sin preselección: primero el
 * selector de cliente, reusando el mecanismo de `nueva-tarea-overlay.tsx`).
 *
 * Invariante de montaje (mismo contrato que `editar-cliente-overlay.tsx`):
 * `cliente` arranca de `clientePreseleccionado` solo en el primer render, así
 * que quien use este componente DEBE remontarlo al abrir (ver `key` en la
 * Ficha y en Hoy) — de lo contrario, reabrir el overlay reutilizaría el
 * cliente de la apertura anterior.
 *
 * Primer uso en este código de `withOptimisticUpdate` de Convex: en el resto
 * del proyecto (p. ej. `hoy/page.tsx`'s `completar()`) alcanza con estado
 * React manual para ocultar un ítem existente, pero acá hace falta insertar
 * un ítem nuevo con id generado por el servidor en una o dos listas que
 * pueden no estar montadas — por eso el cambio de herramienta.
 */
export function AnotarInteraccionOverlay({
  open,
  onClose,
  clientePreseleccionado,
}: AnotarInteraccionOverlayProps) {
  const { show } = useToast();
  const yo = useQuery(api.usuarios.yo);
  const crearInteraccion = useMutation(api.interacciones.crear).withOptimisticUpdate(
    (localStore, args) => {
      const filaBase = {
        _id: ("optimistic:" + crypto.randomUUID()) as Id<"interacciones">,
        tipo: args.tipo,
        nota: args.nota,
        // Este callback no corre durante el render: Convex lo invoca al
        // momento de llamar la mutación (click en Guardar), igual que
        // crypto.randomUUID() arriba. El linter no distingue eso del código
        // de render porque la función está definida léxicamente dentro del
        // componente.
        // eslint-disable-next-line react-hooks/purity
        fecha: Date.now(),
        autor: yo ? { nombre: yo.nombre } : null,
      };

      const porCliente = localStore.getQuery(api.interacciones.listarPorCliente, {
        clienteId: args.clienteId,
      });
      if (porCliente !== undefined) {
        localStore.setQuery(api.interacciones.listarPorCliente, { clienteId: args.clienteId }, [
          filaBase,
          ...porCliente,
        ]);
      }

      const recientes = localStore.getQuery(api.interacciones.listarRecientes, {});
      if (recientes !== undefined) {
        // .slice(0, 20): sin este recorte la lista optimista tendría 21
        // filas hasta que la respuesta real (que sí respeta el límite del
        // servidor) la reemplace — cosmético, nunca corrompe datos.
        localStore.setQuery(
          api.interacciones.listarRecientes,
          {},
          [
            {
              ...filaBase,
              clienteId: args.clienteId,
              cliente: cliente ? { nombre: cliente.nombre } : null,
            },
            ...recientes,
          ].slice(0, 20)
        );
      }
    }
  );

  const [cliente, setCliente] = useState<ClienteSeleccionado | null>(
    clientePreseleccionado ?? null
  );
  const [busqueda, setBusqueda] = useState("");
  const [altaInlineAbierta, setAltaInlineAbierta] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [contactoNuevo, setContactoNuevo] = useState("");
  const [creandoClienteInline, setCreandoClienteInline] = useState(false);
  const [canal, setCanal] = useState<CanalInteraccion | "">("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const crearClienteMinimo = useMutation(api.clientes.crearMinimo);
  const resultados = useQuery(
    api.clientes.buscar,
    open && !clientePreseleccionado && !cliente ? { texto: busqueda } : "skip"
  );

  function reiniciar() {
    setCliente(clientePreseleccionado ?? null);
    setBusqueda("");
    setAltaInlineAbierta(false);
    setNombreNuevo("");
    setContactoNuevo("");
    setCanal("");
    setNota("");
  }

  function cerrar() {
    reiniciar();
    onClose();
  }

  async function crearClienteInline() {
    if (!nombreNuevo.trim() || creandoClienteInline) return;
    setCreandoClienteInline(true);
    try {
      const esEmail = contactoNuevo.includes("@");
      const id = await crearClienteMinimo({
        nombre: nombreNuevo.trim(),
        telefono: !esEmail && contactoNuevo.trim() ? contactoNuevo.trim() : undefined,
        email: esEmail && contactoNuevo.trim() ? contactoNuevo.trim() : undefined,
      });
      setCliente({ id, nombre: nombreNuevo.trim() });
      setAltaInlineAbierta(false);
      setNombreNuevo("");
      setContactoNuevo("");
    } catch {
      show("No se pudo crear el cliente. Intenta de nuevo.");
    } finally {
      setCreandoClienteInline(false);
    }
  }

  async function guardar() {
    if (!cliente || !canal || !nota.trim() || guardando) return;
    setGuardando(true);
    try {
      await crearInteraccion({ clienteId: cliente.id, tipo: canal, nota: nota.trim() });
      show("Interacción registrada");
      cerrar();
    } catch {
      show("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const puedeGuardar = Boolean(cliente && canal && nota.trim() && !guardando);

  return (
    <Overlay open={open} onClose={cerrar} title="Anotar interacción">
      <div className="flex flex-col gap-4">
        {!clientePreseleccionado && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-(--color-text)">Cliente</span>

            {cliente ? (
              <div className="flex items-center justify-between gap-2 rounded-(--radius-md) border border-(--color-border-strong) px-3.5 py-2.5">
                <span className="text-[15px]">{cliente.nombre}</span>
                <Button variant="ghost" size="compact" onClick={() => setCliente(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search
                    size={16}
                    strokeWidth={1.5}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-text-subtle)"
                  />
                  <Input
                    placeholder="Buscar por nombre…"
                    className="pl-10"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>

                {!altaInlineAbierta && (
                  <ul className="flex max-h-40 flex-col overflow-y-auto rounded-(--radius-md) border border-(--color-border)">
                    {resultados?.map((resultado) => (
                      <li key={resultado._id}>
                        <button
                          type="button"
                          onClick={() => setCliente({ id: resultado._id, nombre: resultado.nombre })}
                          className="w-full px-3.5 py-2.5 text-left text-[14px] hover:bg-(--color-surface-2)"
                        >
                          {resultado.nombre}
                        </button>
                      </li>
                    ))}
                    {resultados && resultados.length === 0 && (
                      <li className="px-3.5 py-2.5 text-[13px] text-(--color-text-subtle)">
                        Sin resultados.
                      </li>
                    )}
                  </ul>
                )}

                {altaInlineAbierta ? (
                  <div className="flex flex-col gap-2 rounded-(--radius-md) border border-(--color-border) p-3.5">
                    <Input
                      label="Nombre del cliente nuevo"
                      value={nombreNuevo}
                      onChange={(e) => setNombreNuevo(e.target.value)}
                    />
                    <Input
                      label="Teléfono o email (opcional)"
                      value={contactoNuevo}
                      onChange={(e) => setContactoNuevo(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="compact"
                        onClick={() => setAltaInlineAbierta(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="compact"
                        disabled={!nombreNuevo.trim() || creandoClienteInline}
                        onClick={crearClienteInline}
                      >
                        {creandoClienteInline ? "Creando…" : "Crear y usar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="compact"
                    className="w-fit"
                    onClick={() => setAltaInlineAbierta(true)}
                  >
                    <UserPlus size={16} strokeWidth={1.5} />
                    Nuevo cliente
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="canal-interaccion" className="text-sm font-medium text-(--color-text)">
            Canal
          </label>
          <select
            id="canal-interaccion"
            className={selectClass}
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalInteraccion | "")}
          >
            <option value="">Elegir canal…</option>
            {Object.entries(CANALES_INTERACCION).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota-interaccion" className="text-sm font-medium text-(--color-text)">
            Nota
          </label>
          <textarea
            id="nota-interaccion"
            className={textareaClass}
            placeholder="¿Qué se habló?"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <Button onClick={guardar} disabled={!puedeGuardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </Overlay>
  );
}
