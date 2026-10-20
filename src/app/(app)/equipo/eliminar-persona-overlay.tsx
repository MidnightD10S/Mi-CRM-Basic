"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Overlay } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, type Id } from "@/lib/convex-generated";

interface EliminarPersonaOverlayProps {
  open: boolean;
  onClose: () => void;
  persona: { _id: Id<"usuarios">; nombre: string } | null;
}

/** MID-9: copy exacto del diseño — "¿Eliminar a [nombre]? Esta acción no se puede deshacer." */
export function EliminarPersonaOverlay({ open, onClose, persona }: EliminarPersonaOverlayProps) {
  const { show } = useToast();
  const eliminar = useAction(api.usuarios.eliminar);
  const [eliminando, setEliminando] = useState(false);

  async function confirmar() {
    if (!persona || eliminando) return;
    setEliminando(true);
    try {
      await eliminar({ usuarioId: persona._id });
      show("Usuario eliminado");
      onClose();
    } catch (error) {
      show(error instanceof Error ? error.message : "No se pudo eliminar. Intenta de nuevo.");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <Overlay open={open} onClose={onClose} title="Eliminar persona">
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-(--color-text)">
          ¿Eliminar a {persona?.nombre}? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={eliminando}>
            Cancelar
          </Button>
          <Button variant="destructive" className="flex-1" onClick={confirmar} disabled={eliminando}>
            {eliminando ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
