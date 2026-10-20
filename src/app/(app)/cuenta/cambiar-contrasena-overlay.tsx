"use client";

import { useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/convex-generated";

interface CambiarContrasenaOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * MID-8: cambio de contraseña autenticado. Usa `usuarios.cambiarContrasena`
 * (verifica la actual con `retrieveAccount` y fija la nueva con
 * `modifyAccountCredentials`, ambas de `@convex-dev/auth/server`) — no
 * reutiliza el flujo de código por email de MID-44, que es para cuando NO
 * se tiene la contraseña actual a mano.
 */
export function CambiarContrasenaOverlay({ open, onClose }: CambiarContrasenaOverlayProps) {
  const { show } = useToast();
  const cambiarContrasena = useAction(api.usuarios.cambiarContrasena);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [guardando, setGuardando] = useState(false);

  const nuevaValida = nueva.length >= 8;
  const puedeGuardar = Boolean(actual && nuevaValida && nueva === repetir && !guardando);

  function reiniciar() {
    setActual("");
    setNueva("");
    setRepetir("");
  }

  function cerrar() {
    reiniciar();
    onClose();
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      await cambiarContrasena({ contrasenaActual: actual, contrasenaNueva: nueva });
      show("Contraseña actualizada");
      cerrar();
    } catch (error) {
      show(error instanceof Error ? error.message : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Overlay open={open} onClose={cerrar} title="Cambiar contraseña">
      <form className="flex flex-col gap-4" onSubmit={guardar}>
        <Input
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          required
        />
        <Input
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          error={nueva && !nuevaValida ? "Debe tener al menos 8 caracteres." : undefined}
          required
        />
        <Input
          label="Repetir nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          error={repetir && nueva !== repetir ? "No coincide con la nueva contraseña." : undefined}
          required
        />
        <Button type="submit" disabled={!puedeGuardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </Overlay>
  );
}
