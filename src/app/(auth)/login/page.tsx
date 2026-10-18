"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * MID-7: pantalla de inicio de sesión real (reemplaza el placeholder). Al
 * iniciar sesión correctamente, abre directamente "Tareas del día" (/hoy);
 * la sesión persiste entre recargas (gestionado por ConvexAuthProvider, ver
 * src/components/providers/convex-client-provider.tsx).
 *
 * El enlace "¿Olvidaste tu contraseña?" lleva al placeholder existente de
 * MID-44 — deliberadamente fuera de alcance de esta pantalla (decisión
 * explícita: el envío de email real necesitaría un proveedor como Resend).
 */
// `useSearchParams` obliga a envolver en Suspense (requisito de Next.js
// para no romper el render estático de la página) — ver export default.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviandoGoogle, setEnviandoGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/hoy");
    }
  }, [isLoading, isAuthenticated, router]);

  // MID-46: Convex Auth no manda ningún código de error en la URL de
  // retorno cuando rechaza un login de Google (ver convex/auth.ts) — solo
  // redirige de vuelta sin crear sesión. El `?google=1` lo agregamos
  // nosotros mismos antes de salir hacia Google (más abajo) para poder
  // distinguir "volvimos de un intento fallido" de "alguien entró
  // directamente a /login" — se deriva en cada render, sin `useEffect`,
  // para no disparar un `setState` en efecto.
  const errorGoogle =
    !isLoading && !isAuthenticated && searchParams.get("google") === "1"
      ? "No se pudo completar el inicio de sesión con Google. Si tu cuenta no está autorizada, contactá a la propietaria."
      : null;

  const puedeEnviar = Boolean(EMAIL_REGEX.test(email) && password.trim() && !enviando);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true);
    setError(null);
    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push("/hoy");
    } catch {
      setError("Email o contraseña incorrectos.");
    } finally {
      setEnviando(false);
    }
  }

  async function entrarConGoogle() {
    setEnviandoGoogle(true);
    setError(null);
    try {
      await signIn("google", { redirectTo: "/login?google=1" });
    } catch {
      setError("No se pudo iniciar el inicio de sesión con Google.");
      setEnviandoGoogle(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-(--radius-lg) bg-(--color-primary) text-base font-semibold text-(--color-on-primary)">
          V
        </span>
        <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">Vibe CRM</h1>
      </div>

      <form className="flex flex-col gap-4" onSubmit={entrar}>
        {(error ?? errorGoogle) && (
          <div
            role="alert"
            className="rounded-(--radius-md) border border-(--color-error) bg-(--color-error-bg) px-3.5 py-2.5 text-[14px] font-medium text-(--color-error-text)"
          >
            {error ?? errorGoogle}
          </div>
        )}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-password" className="text-sm font-medium text-(--color-text)">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={mostrarPassword ? "text" : "password"}
              autoComplete="current-password"
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
        </div>

        <Link
          href="/recuperar-contrasena"
          className="self-start text-[13px] font-medium text-(--color-primary) hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>

        <Button type="submit" disabled={!puedeEnviar}>
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-[13px] text-(--color-text-subtle)">
        <div className="h-px flex-1 bg-(--color-border)" />
        o
        <div className="h-px flex-1 bg-(--color-border)" />
      </div>

      <Button type="button" variant="secondary" disabled={enviandoGoogle} onClick={entrarConGoogle}>
        {enviandoGoogle ? "Conectando…" : "Continuar con Google"}
      </Button>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
