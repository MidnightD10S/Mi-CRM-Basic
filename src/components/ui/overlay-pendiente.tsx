import { Construction } from "lucide-react";
import { Overlay } from "@/components/ui/overlay";

interface OverlayPendienteProps {
  open: boolean;
  onClose: () => void;
  titulo: string;
  issue: string;
  descripcion: string;
}

/**
 * Overlay accesible (ver src/components/ui/overlay.tsx) con el mismo aviso que
 * `PantallaPendiente`, para accesos rápidos cuyo formulario todavía no existe.
 */
export function OverlayPendiente({ open, onClose, titulo, issue, descripcion }: OverlayPendienteProps) {
  return (
    <Overlay open={open} onClose={onClose} title={titulo}>
      <div className="flex flex-col items-start gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-(--radius-lg) bg-(--color-surface-2) text-(--color-text-subtle)">
          <Construction size={20} strokeWidth={1.5} />
        </span>
        <p className="text-[15px] font-semibold">Pantalla pendiente de construir</p>
        <p className="text-[13px] text-(--color-text-muted)">{descripcion}</p>
        <p className="text-xs text-(--color-text-subtle)">Issue de Linear: {issue}</p>
      </div>
    </Overlay>
  );
}
