"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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

type Phase = "closed" | "opening" | "open" | "closing";

// Margen sobre --duration-fast (150ms) para el timeout de respaldo de abajo.
const CLOSE_FALLBACK_MS = 200;

/**
 * Panel superpuesto accesible (MID-10): hoja inferior en móvil, modal en
 * escritorio. role="dialog" + aria-modal, foco atrapado dentro, el resto de la
 * app queda `inert` mientras está abierto, cierra con el botón de cierre, el
 * scrim o Esc, y devuelve el foco al elemento que lo abrió al cerrarse.
 *
 * MID-24: además anima apertura/cierre (hoja desde abajo en móvil, fade+scale
 * en escritorio) sin romper nada de lo anterior. El desafío es que cerrar no
 * puede desmontar de inmediato (como antes, `if (!open) return null`) porque
 * entonces la animación de cierre nunca se vería — hay que seguir
 * renderizando durante `"closing"` hasta que la transición termina.
 */
export function Overlay({ open, onClose, title, children, className }: OverlayProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();

  // Arranca siempre en "closed", incluso si `open` ya es `true` en el primer
  // render (pasa con el patrón de `key` por contador que usan los
  // llamadores: abren una instancia nueva directamente con `open=true`). Si
  // arrancara en "open" directo, el primer frame ya se vería en el estado
  // final — sin nada de qué animar la entrada — y el efecto de abajo igual
  // forzaría un salto a "opening" y de vuelta a "open" un instante después,
  // produciendo un destello en vez de una transición. Arrancando en
  // "closed", el mismo efecto de abajo se encarga de la secuencia de
  // entrada de forma uniforme, se haya montado con `open` en `true` o en
  // `false`.
  const [phase, setPhase] = useState<Phase>("closed");
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Todo `setPhase` de abajo vive dentro de un callback (de `setTimeout`/
  // `requestAnimationFrame`), nunca como primera instrucción sincrónica del
  // cuerpo del efecto — el linter de React 19.3 marca eso como "cascading
  // renders" aunque sea exactamente el patrón recomendado (responder a un
  // evento asíncrono real), así que el disparador en sí también se difiere
  // un tick con `setTimeout(…, 0)` para quedar dentro de un callback.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        setPhase("opening");
        // Un frame con los estilos de "cerrado" y recién el siguiente pasa a
        // "open" — si se pusiera "open" de una, el navegador podría fusionar
        // ambos estilos en el mismo frame y la transición CSS nunca correría
        // (el clásico bug de "animar al montar").
        requestAnimationFrame(() => setPhase("open"));
      }, 0);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setPhase((p) => (p === "closed" ? "closed" : "closing"));

      // Con movimiento reducido la duración es 0 y `transitionend` no está
      // garantizado a esa duración — se salta directo a "closed" sin
      // esperar ningún evento.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPhase("closed");
        return;
      }

      // Respaldo: si `onTransitionEnd` nunca llega (p. ej. la transición se
      // cancela por un reabrir rápido), esto fuerza "closed" igual.
      closeTimeoutRef.current = setTimeout(() => setPhase("closed"), CLOSE_FALLBACK_MS);
    }, 0);

    return () => {
      clearTimeout(t);
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [open]);

  const shouldRender = phase !== "closed";

  function handlePanelTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (phase !== "closing") return;
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setPhase("closed");
  }

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

  // MID-24: atado a `shouldRender` (sigue `true` durante `"closing"`), no a
  // `open` — si dependiera de `open`, el foco se devolvería y el fondo
  // dejaría de ser `inert` apenas empieza el cierre, mientras el panel
  // todavía se ve en pantalla animando hacia afuera.
  useEffect(() => {
    if (!shouldRender) return;

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
  }, [shouldRender]);

  if (!shouldRender) return null;

  // "opening" usa los mismos estilos "cerrados" que "closed"/"closing" a
  // propósito (ver el comentario del primer efecto): es el estado del primer
  // frame tras montar, antes de que el siguiente frame dispare la transición
  // hacia "open".
  const panelVisible = phase === "open";

  return createPortal(
    <div ref={wrapperRef} className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className={cn(
          "overlay-scrim absolute inset-0 bg-(--color-scrim) transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
          panelVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onTransitionEnd={handlePanelTransitionEnd}
        className={cn(
          "overlay-panel relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-(--radius-xl) bg-(--color-surface) p-5 shadow-[var(--shadow-lg)]",
          // Tailwind v4: `translate-y-*`/`scale-*` son las propiedades CSS
          // individuales `translate`/`scale`, no `transform` — hay que
          // transicionar esas dos explícitamente (no alcanza con
          // `transform`) además de `opacity`.
          "transition-[translate,scale,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
          "md:w-[480px] md:rounded-(--radius-xl)",
          panelVisible
            ? "translate-y-0 opacity-100 md:scale-100"
            : "translate-y-full opacity-0 md:translate-y-0 md:scale-95",
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
