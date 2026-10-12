"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Search, UserPlus } from "lucide-react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, type Id } from "@/lib/convex-generated";

interface NuevaTareaOverlayProps {
  open: boolean;
  onClose: () => void;
  /** null mientras la sesión todavía no se resolvió (ver useSessionUsuario). */
  responsableId: Id<"usuarios"> | null;
}

interface ClienteSeleccionado {
  id: Id<"clientes">;
  nombre: string;
}

/**
 * MID-18: acceso rápido "Nueva tarea". Distinto de "Programar seguimiento"
 * (MID-17, desde la Ficha): solo pide Título + Cliente + Fecha, sin
 * responsable (se asigna al usuario con sesión iniciada).
 *
 * El "+ Nuevo cliente" del selector resuelve con un alta mínima inline
 * (nombre + teléfono/email opcional) — el alta completa es MID-11.
 */
export function NuevaTareaOverlay({ open, onClose, responsableId }: NuevaTareaOverlayProps) {
  const { show } = useToast();
  const crearTarea = useMutation(api.seguimientos.crearTarea);
  const crearClienteMinimo = useMutation(api.clientes.crearMinimo);

  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [cliente, setCliente] = useState<ClienteSeleccionado | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [altaInlineAbierta, setAltaInlineAbierta] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [contactoNuevo, setContactoNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [creandoClienteInline, setCreandoClienteInline] = useState(false);

  const resultados = useQuery(api.clientes.buscar, open && !cliente ? { texto: busqueda } : "skip");

  function reiniciar() {
    setTitulo("");
    setFecha("");
    setCliente(null);
    setBusqueda("");
    setAltaInlineAbierta(false);
    setNombreNuevo("");
    setContactoNuevo("");
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
    if (!titulo.trim() || !cliente || !fecha || !responsableId) return;
    setGuardando(true);
    const [anio, mes, dia] = fecha.split("-").map(Number);
    const vence = new Date(anio, mes - 1, dia).getTime();
    try {
      await crearTarea({
        accion: titulo.trim(),
        clienteId: cliente.id,
        vence,
        responsableId,
      });
      cerrar();
    } catch {
      show("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const sesionLista = responsableId !== null;
  const puedeGuardar = Boolean(titulo.trim() && cliente && fecha && sesionLista && !guardando);

  return (
    <Overlay open={open} onClose={cerrar} title="Nueva tarea">
      <div className="flex flex-col gap-4">
        <Input
          label="Título"
          placeholder="Ej. Llamar para confirmar propuesta"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />

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

        <Input
          type="date"
          label="Fecha"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <Button onClick={guardar} disabled={!puedeGuardar}>
          {sesionLista ? "Guardar" : "Preparando sesión…"}
        </Button>
      </div>
    </Overlay>
  );
}
