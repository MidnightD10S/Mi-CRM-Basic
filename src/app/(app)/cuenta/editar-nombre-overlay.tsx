"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/convex-generated";

interface EditarNombreOverlayProps {
  open: boolean;
  onClose: () => void;
  nombreActual: string;
}

/**
 * MID-8: "Editar mis datos" — solo nombre (ver nota en `editarMiPerfil`).
 * Mismo patrón que `PersonaOverlay`/`EditarClienteOverlay`: el valor
 * inicial se toma de `nombreActual` solo en el primer render; quien lo usa
 * debe remontarlo con una `key` que cambie al abrir (ver `cuenta/page.tsx`).
 */
export function EditarNombreOverlay({ open, onClose, nombreActual }: EditarNombreOverlayProps) {
  const { show } = useToast();
  const editarMiPerfil = useMutation(api.usuarios.editarMiPerfil);
  const [nombre, setNombre] = useState(nombreActual);
  const [guardando, setGuardando] = useState(false);

  const puedeGuardar = Boolean(nombre.trim() && !guardando);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      await editarMiPerfil({ nombre: nombre.trim() });
      show("Datos actualizados");
      onClose();
    } catch (error) {
      show(error instanceof Error ? error.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Overlay open={open} onClose={onClose} title="Editar mis datos">
      <form className="flex flex-col gap-4" onSubmit={guardar}>
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <Button type="submit" disabled={!puedeGuardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </Overlay>
  );
}
