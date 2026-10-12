import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-12 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-(--radius-lg) bg-(--color-surface-2) text-(--color-text-subtle)">
        <Icon size={24} strokeWidth={1.5} />
      </span>
      <p className="text-[15px] font-semibold text-(--color-text)">{title}</p>
      <p className="max-w-xs text-[13px] text-(--color-text-muted)">{description}</p>
      {action}
    </div>
  );
}
