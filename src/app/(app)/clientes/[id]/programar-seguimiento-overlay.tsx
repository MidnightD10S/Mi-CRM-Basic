"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, type Id } from "@/lib/convex-generated";

interface ProgramarSeguimientoOverlayProps {
  open: boolean;
  onClose: () => void;
  clienteId: Id<"clientes">;
}

const selectClass =
  "h-12 rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 text-[15px] text-(--color-text) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]";

/**
 * MID-17: formulario de "Programar seguimiento" exclusivo de la Ficha de
 * cliente — distinto de `NuevaTareaOverlay` (Hoy), que pide elegir cliente
 * pero no responsable. Son dos UIs separadas para la misma entidad
 * `seguimientos` (así lo dice el propio issue): acá no hace falta elegir
 * cliente (ya estamos en su ficha) pero sí se puede reasignar el
 * responsable, por defecto la sesión actual.
 *
 * Sin selector de cliente y sin optimistic update (a diferencia de
 * `AnotarInteraccionOverlay`): MID-17 no lo pide, y `NuevaTareaOverlay` —el
 * precedente más cercano para esta misma entidad— tampoco lo usa. La lista
 * de pendientes de la Ficha ya es una `useQuery` reactiva que se actualiza
 * sola en cuanto el servidor confirma.
 */
export function ProgramarSeguimientoOverlay({
  open,
  onClose,
  clienteId,
}: ProgramarSeguimientoOverlayProps) {
  const { show } = useToast();
  const yo = useQuery(api.usuarios.yo);
  const usuarios = useQuery(api.usuarios.listar);
  const crearTarea = useMutation(api.seguimientos.crearTarea);

  const [accion, setAccion] = useState("");
  const [vence, setVence] = useState("");
  const [responsable, setResponsable] = useState<Id<"usuarios"> | "">("");
  const [guardando, setGuardando] = useState(false);

  function reiniciar() {
    setAccion("");
    setVence("");
    setResponsable("");
  }

  function cerrar() {
    reiniciar();
    onClose();
  }

  // El `<select>` se preselecciona a la sesión en cuanto `yo` carga, sin un
  // efecto de sincronización: `responsable` solo se escribe cuando la
  // persona elige explícitamente otra opción.
  const responsableMostrado = responsable || yo?._id || "";

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const responsableFinal = responsable || yo?._id;
    if (!accion.trim() || !vence || !responsableFinal || guardando) return;
    setGuardando(true);
    const [anio, mes, dia] = vence.split("-").map(Number);
    try {
      await crearTarea({
        accion: accion.trim(),
        clienteId,
        vence: new Date(anio, mes - 1, dia).getTime(),
        responsableId: responsableFinal,
      });
      show("Seguimiento programado");
      cerrar();
    } catch {
      show("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const puedeGuardar = Boolean(accion.trim() && vence && (responsable || yo) && !guardando);

  return (
    <Overlay open={open} onClose={cerrar} title="Programar seguimiento">
      <form className="flex flex-col gap-4" onSubmit={guardar}>
        <Input
          label="¿Qué hay que hacer?"
          placeholder="Ej. Llamar para confirmar propuesta"
          value={accion}
          onChange={(e) => setAccion(e.target.value)}
        />

        <Input
          type="date"
          label="Fecha"
          value={vence}
          onChange={(e) => setVence(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="responsable-seguimiento" className="text-sm font-medium text-(--color-text)">
            Responsable
          </label>
          <select
            id="responsable-seguimiento"
            className={selectClass}
            value={responsableMostrado}
            onChange={(e) => setResponsable(e.target.value as Id<"usuarios">)}
          >
            {usuarios?.map((usuario) => (
              <option key={usuario._id} value={usuario._id}>
                {usuario.nombre}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={!puedeGuardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </Overlay>
  );
}
