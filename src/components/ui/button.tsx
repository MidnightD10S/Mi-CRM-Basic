import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "default" | "compact" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-(--radius-md) font-medium " +
  "text-[15px] transition-colors duration-150 ease-[var(--ease-standard)] " +
  "disabled:cursor-not-allowed disabled:bg-(--color-surface-2) disabled:text-(--color-text-subtle) " +
  "disabled:shadow-none focus-visible:outline-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-(--color-primary) text-(--color-on-primary) font-semibold hover:bg-(--color-primary-hover) active:bg-(--color-primary-active)",
  secondary:
    "bg-(--color-surface) border border-(--color-border-strong) text-(--color-text) hover:bg-(--color-surface-2)",
  ghost: "bg-transparent text-(--color-text-muted) hover:bg-(--color-surface-2)",
  destructive: "bg-(--color-error) text-white font-semibold hover:brightness-90",
};

const sizes: Record<Size, string> = {
  default: "h-12 px-5",
  compact: "h-11 px-4",
  icon: "h-12 w-12 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
