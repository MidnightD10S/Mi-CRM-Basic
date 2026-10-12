"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Panel superpuesto accesible (MID-10): hoja inferior en móvil, modal en
 * escritorio. role="dialog" + aria-modal, foco atrapado dentro, el resto de la
 * app queda `inert` mientras está abierto, cierra con el botón de cierre, el
 * scrim o Esc, y devuelve el foco al elemento que lo abrió al cerrarse.
 */
export function Overlay({ open, onClose, title, children, className }: OverlayProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();

  // `onClose` suele ser una función nueva en cada render (p. ej. un closure
  // que también resetea el formulario). Si el efecto de abajo dependiera de
  // `onClose` directamente, cada tecleo que causara un re-render de quien usa
  // Overlay volvería a ejecutar el efecto: restauraría el foco al disparador
  // y luego lo movería al primer campo, sacando el foco del campo en uso. Por
  // eso el efecto depende solo de `open`, y lee siempre la última `onClose`
  // a través de esta ref.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement;

    const siblings = Array.from(document.body.children).filter(
      (el) => el !== wrapperRef.current
    );
    const alreadyInert = new Set(siblings.filter((el) => el.hasAttribute("inert")));
    siblings.forEach((el) => el.setAttribute("inert", ""));

    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusables?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      siblings.forEach((el) => {
        if (!alreadyInert.has(el)) el.removeAttribute("inert");
      });
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div ref={wrapperRef} className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-(--radius-xl) bg-(--color-surface) p-5 shadow-[var(--shadow-lg)]",
          "md:w-[480px] md:rounded-(--radius-xl)",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-[var(--tracking-tight)]">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-md) text-(--color-text-subtle) hover:bg-(--color-surface-2)"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
