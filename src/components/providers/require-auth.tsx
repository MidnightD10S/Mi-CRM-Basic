"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useSessionUsuario } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/convex-generated";

/**
 * MID-7/MID-10: cierra el hueco que dejaba pendiente el control de acceso —
 * sin sesión real, cualquiera podía ver el contenido de `(app)`. El guard es
 * una mejora de UX (redirige antes de mostrar nada), no el control de
 * seguridad real: eso vive en el backend (`requireUsuario`, ver
 * convex/authHelpers.ts), porque un guard de React no protege las funciones
 * de Convex si se llaman directamente.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const sesion = useSessionUsuario();
  const router = useRouter();
  const asegurarSeedUsuarios = useMutation(api.usuarios.asegurarSeed);

  useEffect(() => {
    if (sesion.status === "sin_sesion") {
      router.replace("/login");
    }
  }, [sesion.status, router]);

  if (sesion.status === "cargando" || sesion.status === "sin_sesion") {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-3 p-5">
        <p className="text-[14px] text-(--color-text-subtle)">Cargando…</p>
      </div>
    );
  }

  if (sesion.status === "no_encontrado") {
    return (
      <div className="mx-auto flex max-w-[860px] flex-col gap-3 p-5">
        <p className="text-[15px] font-semibold text-(--color-error-text)">
          No se pudo preparar tu sesión.
        </p>
        <Button
          variant="secondary"
          size="compact"
          className="w-fit"
          onClick={() => asegurarSeedUsuarios()}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
