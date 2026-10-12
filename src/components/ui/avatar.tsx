import { cn } from "@/lib/utils";

export interface AvatarProps {
  nombre: string;
  neutral?: boolean;
  className?: string;
}

function initials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

export function Avatar({ nombre, neutral = false, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-full) text-sm font-semibold",
        neutral
          ? "bg-(--color-surface-2) text-(--color-text-muted)"
          : "bg-(--color-primary-subtle) text-(--color-primary)",
        className
      )}
      aria-hidden="true"
    >
      {initials(nombre)}
    </span>
  );
}
