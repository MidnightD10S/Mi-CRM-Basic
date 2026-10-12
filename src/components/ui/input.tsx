import { type InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-(--color-text)">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            "h-12 rounded-(--radius-md) border bg-(--color-surface) px-3.5 text-[15px] text-(--color-text)",
            "placeholder:text-(--color-text-subtle) transition-colors duration-150",
            "disabled:bg-(--color-surface-2) disabled:text-(--color-text-subtle)",
            error
              ? "border-(--color-error) shadow-[0_0_0_3px_var(--color-error-bg)]"
              : "border-(--color-border-strong) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]",
            className
          )}
          {...props}
        />
        {error && <p className="text-[13px] text-(--color-error-text)">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
