"use client";

import { type ReactNode } from "react";
import { ErrorBoundary } from "@/components/providers/error-boundary";
import { Button } from "@/components/ui/button";

/**
 * Envuelve `ErrorBoundary` con un fallback genérico. Separado de `AppLayout`
 * (componente de servidor) porque una función (el `fallback`) no se puede
 * pasar como prop de servidor a cliente — debe definirse aquí, dentro de un
 * componente cliente.
 *
 * Deliberadamente genérico: envuelve toda la pantalla, así que puede atrapar
 * el fallo de *cualquier* query que lance dentro de ese árbol (sesión,
 * seguimientos, etc.), no solo el de `useSessionUsuario`. Atribuir el error a
 * un subsistema concreto ("no se pudo preparar tu sesión") sería incorrecto
 * cuando en realidad falló otra cosa.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <div className="mx-auto flex max-w-[860px] flex-col gap-3 p-5">
          <p className="text-[15px] font-semibold text-(--color-error-text)">
            No se pudo cargar esta pantalla.
          </p>
          <Button variant="secondary" size="compact" className="w-fit" onClick={reset}>
            Reintentar
          </Button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
