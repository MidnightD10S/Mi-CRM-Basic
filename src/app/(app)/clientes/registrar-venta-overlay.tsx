"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Search, UserPlus } from "lucide-react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ESTADOS_VENTA, type EstadoVenta } from "@/lib/constants";
import { formatCurrencyInputFromDigits, parseCurrencyDigitsToNumber } from "@/lib/format";
import { api, type Id } from "@/lib/convex-generated";

interface RegistrarVentaOverlayProps {
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

function fechaDeHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/**
 * MID-21: un solo formulario de "Registrar venta" (concepto + importe +
 * estado + fecha), usado tanto desde la Ficha de cliente (con
 * `clientePreseleccionado`, sin selector) como desde Hoy (sin preselección:
 * primero el selector de cliente). Mismo selector de cliente que
 * `anotar-interaccion-overlay.tsx` (copiado tal cual, incluyendo el
 * invariante de remount por `key` que exige quien use este componente).
 *
 * Sin optimistic update, a diferencia de `anotar-interaccion-overlay.tsx`:
 * el único consumidor reactivo es el historial de la Ficha
 * (`ventas.listarPorCliente`), que ya se actualiza solo en cuanto el
 * servidor confirma — no hay un feed en Hoy que necesite una fila al
 * instante. Mismo criterio ya documentado en `programar-seguimiento-overlay.tsx`.
 */
export function RegistrarVentaOverlay({
  open,
  onClose,
  clientePreseleccionado,
}: RegistrarVentaOverlayProps) {
  const { show } = useToast();
  const crearVenta = useMutation(api.ventas.crear);
  const crearClienteMinimo = useMutation(api.clientes.crearMinimo);

  const [cliente, setCliente] = useState<ClienteSeleccionado | null>(
    clientePreseleccionado ?? null
  );
  const [busqueda, setBusqueda] = useState("");
  const [altaInlineAbierta, setAltaInlineAbierta] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [contactoNuevo, setContactoNuevo] = useState("");
  const [creandoClienteInline, setCreandoClienteInline] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [importeDigitos, setImporteDigitos] = useState("");
  const [estado, setEstado] = useState<EstadoVenta>("oportunidad_abierta");
  const [fecha, setFecha] = useState(fechaDeHoy());
  const [guardando, setGuardando] = useState(false);

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
    setConcepto("");
    setImporteDigitos("");
    setEstado("oportunidad_abierta");
    setFecha(fechaDeHoy());
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
    const importe = parseCurrencyDigitsToNumber(importeDigitos);
    if (!cliente || !concepto.trim() || !(importe > 0) || !fecha || guardando) return;
    setGuardando(true);
    const [anio, mes, dia] = fecha.split("-").map(Number);
    try {
      await crearVenta({
        clienteId: cliente.id,
        concepto: concepto.trim(),
        importe,
        estado,
        fecha: new Date(anio, mes - 1, dia).getTime(),
      });
      show("Venta registrada");
      cerrar();
    } catch {
      show("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const importeNumero = parseCurrencyDigitsToNumber(importeDigitos);
  const puedeGuardar = Boolean(
    cliente && concepto.trim() && importeNumero > 0 && fecha && !guardando
  );

  return (
    <Overlay open={open} onClose={cerrar} title="Registrar venta">
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

        <Input
          label="¿Qué se vende?"
          placeholder="Ej. Curso de X, Consultoría, Pack de plantillas"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="importe-venta" className="text-sm font-medium text-(--color-text)">
            Importe
          </label>
          <div className="flex items-center gap-2 rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 focus-within:border-(--color-primary) focus-within:shadow-[var(--focus-ring)]">
            <span className="text-[15px] text-(--color-text-subtle)">$</span>
            <input
              id="importe-venta"
              inputMode="numeric"
              placeholder="0.00"
              value={formatCurrencyInputFromDigits(importeDigitos)}
              onChange={(e) => setImporteDigitos(e.target.value.replace(/[^0-9]/g, ""))}
              className="h-12 w-full bg-transparent text-[15px] text-(--color-text) outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="estado-venta" className="text-sm font-medium text-(--color-text)">
            Estado
          </label>
          <select
            id="estado-venta"
            className={selectClass}
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoVenta)}
          >
            {Object.entries(ESTADOS_VENTA).map(([valor, info]) => (
              <option key={valor} value={valor}>
                {info.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          type="date"
          label="Fecha"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <Button onClick={guardar} disabled={!puedeGuardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </Overlay>
  );
}
