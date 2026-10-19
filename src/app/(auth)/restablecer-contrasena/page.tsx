"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LARGO_CODIGO = 6;
// Mínimo real exigido por Convex Auth (`validateDefaultPasswordRequirements`
// en el provider Password) — no 6, como decía el placeholder viejo.
const LARGO_MINIMO_PASSWORD = 8;

/**
 * MID-44: paso 2 del reset real. Necesita el `email` del paso 1 (llega por
 * query param desde recuperar-contrasena/page.tsx) — por eso usa
 * `useSearchParams` y queda envuelto en `<Suspense>` más abajo, mismo
 * patrón que login/page.tsx.
 */
function RestablecerContrasenaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuthActions();

  const email = searchParams.get("email");

  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [repetirPassword, setRepetirPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">Restablecer contraseña</h1>
        <p className="text-[14px] text-(--color-text-subtle)">
          Para restablecer tu contraseña, primero pedí un código.
        </p>
        <Link
          href="/recuperar-contrasena"
          className="text-[13px] font-medium text-(--color-primary) hover:underline"
        >
          Pedir código
        </Link>
      </div>
    );
  }

  const passwordsCoinciden = password === repetirPassword;
  const puedeEnviar = Boolean(
    codigo.trim().length === LARGO_CODIGO &&
      password.length >= LARGO_MINIMO_PASSWORD &&
      passwordsCoinciden &&
      !enviando
  );

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError(null);
    try {
      await signIn("password", {
        email: email as string,
        code: codigo.trim(),
        newPassword: password,
        flow: "reset-verification",
      });
      // Convex Auth ya deja una sesión válida tras un reset exitoso.
      router.push("/hoy");
    } catch {
      // "Invalid code" cubre código incorrecto, vencido, o de otra cuenta
      // por igual (ver convex/auth.ts) — no hay forma de distinguirlos.
      setError("Código inválido o vencido. Pedí uno nuevo.");
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-(--radius-lg) bg-(--color-primary) text-base font-semibold text-(--color-on-primary)">
          V
        </span>
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">Restablecer contraseña</h1>
        <p className="text-[13px] text-(--color-text-subtle)">
          Ingresá el código que te mandamos a {email} y tu nueva contraseña.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={enviar}>
        {error && (
          <div
            role="alert"
            className="rounded-(--radius-md) border border-(--color-error) bg-(--color-error-bg) px-3.5 py-2.5 text-[14px] font-medium text-(--color-error-text)"
          >
            {error}
          </div>
        )}

        <Input
          label="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={LARGO_CODIGO}
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/[^0-9]/g, ""))}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nueva-password" className="text-sm font-medium text-(--color-text)">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="nueva-password"
              type={mostrarPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 pr-11 text-[15px] text-(--color-text) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]"
            />
            <button
              type="button"
              aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={mostrarPassword}
              onClick={() => setMostrarPassword((v) => !v)}
              className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-(--color-text-subtle) hover:text-(--color-text)"
            >
              {mostrarPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </div>
          <p className="text-[13px] text-(--color-text-subtle)">Mínimo {LARGO_MINIMO_PASSWORD} caracteres.</p>
        </div>

        <Input
          label="Repetir contraseña"
          type={mostrarPassword ? "text" : "password"}
          autoComplete="new-password"
          value={repetirPassword}
          onChange={(e) => setRepetirPassword(e.target.value)}
          error={repetirPassword && !passwordsCoinciden ? "Las contraseñas no coinciden." : undefined}
        />

        <Button type="submit" disabled={!puedeEnviar}>
          {enviando ? "Guardando…" : "Guardar contraseña"}
        </Button>

        <Link
          href="/recuperar-contrasena"
          className="self-center text-[13px] font-medium text-(--color-primary) hover:underline"
        >
          ¿No llegó o venció? Volver a pedir el código
        </Link>
      </form>
    </>
  );
}

export default function RestablecerContrasenaPage() {
  return (
    <Suspense fallback={null}>
      <RestablecerContrasenaForm />
    </Suspense>
  );
}
