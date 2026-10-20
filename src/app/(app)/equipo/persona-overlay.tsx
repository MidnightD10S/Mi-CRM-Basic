"use client";

import { useState, type FormEvent } from "react";
import { useAction, useMutation } from "convex/react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ROLES, type Rol } from "@/lib/constants";
import { api, type Id } from "@/lib/convex-generated";

export interface PersonaEnEdicion {
  _id: Id<"usuarios">;
  nombre: string;
  email: string;
  rol: Rol;
}

interface PersonaOverlayProps {
  open: boolean;
  onClose: () => void;
  /** `null` = alta; con valor = edición de esa persona. */
  persona: PersonaEnEdicion | null;
}

const selectClass =
  "h-12 rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 text-[15px] text-(--color-text) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * MID-9: alta y edición de una persona del equipo. El email solo es
 * editable al dar de alta — editar el email de alguien ya existente queda
 * fuera de alcance (ver `convex/usuarios.ts:editar`, hallazgo de auditoría
 * M3 aplicado también acá por el mismo motivo).
 *
 * El estado inicial de los campos se toma de `persona` en el primer render.
 * Para que siempre arranque con los datos vigentes (y no un valor obsoleto
 * de la vez anterior), quien use este componente debe remontarlo al abrir
 * con una `key` que cambie (ver `equipo/page.tsx`), en vez de sincronizar
 * con un efecto (mismo patrón que `EditarClienteOverlay`).
 */
export function PersonaOverlay({ open, onClose, persona }: PersonaOverlayProps) {
  const { show } = useToast();
  const crear = useAction(api.usuarios.crear);
  const editar = useMutation(api.usuarios.editar);

  const [nombre, setNombre] = useState(persona?.nombre ?? "");
  const [email, setEmail] = useState(persona?.email ?? "");
  const [rol, setRol] = useState<Rol>(persona?.rol ?? "comercial");
  const [guardando, setGuardando] = useState(false);

  function cerrar() {
    onClose();
  }

  const puedeGuardar = Boolean(
    nombre.trim() && (persona || EMAIL_REGEX.test(email)) && !guardando
  );

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      if (persona) {
        await editar({ usuarioId: persona._id, nombre: nombre.trim(), rol });
        show("Usuario actualizado");
      } else {
        const resultado = await crear({ nombre: nombre.trim(), email: email.trim(), rol });
        show(resultado.invitado ? "Usuario añadido — se le envió un email de invitación" : "Usuario añadido, pero no se pudo enviar el email de invitación");
      }
      cerrar();
    } catch (error) {
      show(error instanceof Error ? error.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Overlay open={open} onClose={cerrar} title={persona ? "Editar persona" : "Nueva persona"}>
      <form className="flex flex-col gap-4" onSubmit={guardar}>
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />

        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={Boolean(persona)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="rol-persona" className="text-sm font-medium text-(--color-text)">
            Rol
          </label>
          <select
            id="rol-persona"
            className={selectClass}
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
          >
            {Object.entries(ROLES).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
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
