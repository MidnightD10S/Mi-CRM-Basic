import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "success" | "warning" | "error" | "info" | "primary" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

const tones: Record<BadgeTone, string> = {
  success: "bg-(--color-success-bg) text-(--color-success-text)",
  warning: "bg-(--color-warning-bg) text-(--color-warning-text)",
  error: "bg-(--color-error-bg) text-(--color-error-text)",
  info: "bg-(--color-info-bg) text-(--color-info-text)",
  primary: "bg-(--color-primary-subtle) text-(--color-primary)",
  neutral: "bg-(--color-surface-2) text-(--color-text-muted) border border-(--color-border)",
};

const dotTones: Record<BadgeTone, string> = {
  success: "bg-(--color-success)",
  warning: "bg-(--color-warning)",
  error: "bg-(--color-error)",
  info: "bg-(--color-info)",
  primary: "bg-(--color-primary)",
  neutral: "bg-(--color-text-subtle)",
};

export function Badge({ className, tone = "neutral", dot = true, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-(--radius-full) px-3 py-[5px] text-[13px] font-medium",
        tones[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-[7px] w-[7px] rounded-full", dotTones[tone])} />}
      {children}
    </span>
  );
}
