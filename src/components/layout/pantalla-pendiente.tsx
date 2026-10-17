import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

interface PantallaPendienteProps {
  titulo: string;
  issue: string;
  descripcion: string;
}

/**
 * Placeholder de pantalla todavía sin construir. Cada ruta lo usa hasta que se
 * implementa su issue de Linear correspondiente — reemplazar por la pantalla real.
 */
export function PantallaPendiente({ titulo, issue, descripcion }: PantallaPendienteProps) {
  return (
    // MID-24: `h-full overflow-y-auto` en este div exterior (a todo el
    // ancho) — no en el div de abajo que centra el contenido, o la barra de
    // desplazamiento saldría pegada al borde de esa caja angosta en vez de
    // al borde real de la pantalla. También acota la caja que la View
    // Transition API captura a lo que realmente se ve; sin esto, Cuenta (que
    // no pasa por <ViewTransition>) se quedaría sin cómo hacer scroll — ver
    // src/app/(app)/layout.tsx.
    <div className="h-full overflow-y-auto p-5 pb-16 md:pb-0">
      <div className="mx-auto flex max-w-[860px] flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">{titulo}</h1>
        <Card className="flex flex-col items-start gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-(--radius-lg) bg-(--color-surface-2) text-(--color-text-subtle)">
            <Construction size={20} strokeWidth={1.5} />
          </span>
          <p className="text-[15px] font-semibold">Pantalla pendiente de construir</p>
          <p className="text-[13px] text-(--color-text-muted)">{descripcion}</p>
          <p className="text-xs text-(--color-text-subtle)">Issue de Linear: {issue}</p>
        </Card>
      </div>
    </div>
  );
}
