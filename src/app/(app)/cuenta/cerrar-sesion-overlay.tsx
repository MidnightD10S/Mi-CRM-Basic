"use client";

import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Overlay } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";

interface CerrarSesionOverlayProps {
  open: boolean;
  onClose: () => void;
}

/** MID-8: "Cerrar sesión" exige confirmación antes de ejecutar (no al primer toque). */
export function CerrarSesionOverlay({ open, onClose }: CerrarSesionOverlayProps) {
  const router = useRouter();
  const { signOut } = useAuthActions();

  async function confirmar() {
    try {
      await signOut();
    } finally {
      router.push("/login");
    }
  }

  return (
    <Overlay open={open} onClose={onClose} title="Cerrar sesión">
      <div className="flex flex-col gap-4">
        <p className="text-[15px] text-(--color-text)">¿Querés cerrar tu sesión?</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" className="flex-1" onClick={confirmar}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
