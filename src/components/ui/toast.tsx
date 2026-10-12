"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Con acción (p.ej. "Deshacer"): ventana de ~3.8s, tal como especifica MID-18.
// Al expirar, el botón desaparece junto con el toast — la operación ya quedó
// confirmada en Convex desde el clic, no hay nada que "confirmar" después.
const DURACION_CON_ACCION_MS = 3800;
const DURACION_SIN_ACCION_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const show = useCallback((message: string, options?: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = ++idRef.current;
    setToast({ id, message, actionLabel: options?.actionLabel, onAction: options?.onAction });
    const duracion = options?.onAction ? DURACION_CON_ACCION_MS : DURACION_SIN_ACCION_MS;
    timerRef.current = setTimeout(() => {
      setToast((actual) => (actual?.id === id ? null : actual));
    }, duracion);
  }, []);

  // `onAction` puede ser async (p. ej. deshacer un cambio en Convex) y puede
  // rechazar (sin conexión, etc.). Si no se espera ni se captura, el rechazo
  // queda sin manejar y el usuario no se entera de que la acción falló.
  const ejecutarAccion = useCallback(
    async (accion: () => void | Promise<void>) => {
      try {
        await accion();
      } catch {
        show("No se pudo completar la acción. Intenta de nuevo.");
      }
    },
    [show]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-6"
        >
          <div className="flex items-center gap-3 rounded-(--radius-lg) bg-(--color-text) px-4 py-3 text-[14px] font-medium text-white shadow-[var(--shadow-md)]">
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  if (timerRef.current) clearTimeout(timerRef.current);
                  const { onAction } = toast;
                  setToast(null);
                  if (onAction) void ejecutarAccion(onAction);
                }}
                className="font-semibold underline-offset-2 hover:underline"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
