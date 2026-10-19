"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * MID-44: paso 1 del reset real — pide el email y dispara el flow
 * `"reset"` de Convex Auth (ver convex/auth.ts), que manda un código de 6
 * dígitos si (y solo si) ese email ya tiene una cuenta de contraseña.
 *
 * Si el email no tiene cuenta, Convex Auth lanza `Error("InvalidAccountId")`
 * — a propósito NO se distingue ese caso del éxito: tanto el mensaje como
 * la navegación al paso 2 son siempre los mismos, para no revelar si un
 * email está o no aprovisionado (regla MID-7).
 */
export default function RecuperarContrasenaPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  const puedeEnviar = Boolean(EMAIL_REGEX.test(email) && !enviando);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    try {
      await signIn("password", { email, flow: "reset" });
    } catch {
      // Intencional: mismo camino que el éxito, ver comentario de arriba.
    }
    router.push(`/restablecer-contrasena?email=${encodeURIComponent(email)}`);
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-(--radius-lg) bg-(--color-primary) text-base font-semibold text-(--color-on-primary)">
          V
        </span>
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">Recuperar contraseña</h1>
        <p className="text-[13px] text-(--color-text-subtle)">
          Te vamos a mandar un código a tu email si corresponde a una cuenta existente.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={enviar}>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button type="submit" disabled={!puedeEnviar}>
          {enviando ? "Enviando…" : "Enviar código"}
        </Button>

        <Link
          href="/login"
          className="self-center text-[13px] font-medium text-(--color-primary) hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </form>
    </>
  );
}
