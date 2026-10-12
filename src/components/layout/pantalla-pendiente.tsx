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
    <div className="mx-auto flex max-w-[860px] flex-col gap-4 p-5">
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
  );
}
