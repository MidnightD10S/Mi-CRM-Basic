import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import Google from "@auth/core/providers/google";
import { RateLimiter, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";

// MID-48: la emisión de códigos de reset no tenía ningún límite propio — el
// rate limiting que trae @convex-dev/auth protege la *verificación* del
// código (cuántos intentos de adivinarlo), no su *emisión* (cuántos emails
// se mandan). Sin esto, repetir la solicitud de reset permite bombardear de
// emails a una cuenta y agotar la cuota de Resend. Límite por destinatario,
// no por IP: es lo que impide el abuso contra una cuenta puntual sin
// necesitar acceso a la IP del caller desde `sendVerificationRequest`.
const rateLimiter = new RateLimiter(components.rateLimiter, {
  resetEmailSolicitado: { kind: "token bucket", rate: 3, period: HOUR },
});

// MID-44: 10 minutos de vida para el código de reset — más corto que el
// default de 1h de Convex Auth, porque es un código de 6 dígitos (más
// fácil de adivinar a fuerza bruta que el token largo default) y de todas
// formas `verifyCodeAndSignIn` ya aplica rate limiting contra eso.
const DURACION_CODIGO_RESET_S = 10 * 60;

// `generateVerificationToken` está tipado `() => Promise<string>` (no
// `string` sincrónico) en @convex-dev/auth — tiene que ser `async`.
async function generarCodigoReset(): Promise<string> {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const numero = new DataView(bytes.buffer).getUint32(0);
  return String(numero % 1_000_000).padStart(6, "0");
}

/**
 * MID-44: provider de email para `Password({ reset: ... })` — por default
 * Convex Auth genera un token de 32 caracteres pensado para ir en un link
 * (`url`), no para que una persona lo tipee; `generateVerificationToken`
 * lo cambia por un código numérico corto, y `sendVerificationRequest` usa
 * el campo `token` (el mismo código) en vez de `url` para mandarlo por
 * email con Resend (dominio `contalia.app`, ya verificado).
 *
 * MID-48: `sendVerificationRequest` recibe `ctx` como segundo parámetro
 * (Convex Auth lo pasa igual para providers de tipo "email", aunque el tipo
 * público no lo declara — ver `handleEmailAndPhoneProvider` en
 * @convex-dev/auth/server/implementation/signIn.ts). Se usa para consultar
 * el rate limit antes de llamar a Resend.
 */
const resetPorCodigo = Email({
  maxAge: DURACION_CODIGO_RESET_S,
  generateVerificationToken: generarCodigoReset,
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    // Opcional en el tipo porque el `sendVerificationRequest` público de
    // @auth/core declara un solo parámetro — Convex Auth igual pasa `ctx`
    // en runtime (ver nota arriba); si alguna vez deja de pasarlo, el
    // límite simplemente no se aplicaría en vez de romper el tipo.
    ctx?: ActionCtx,
  ) {
    // Límite de emisión por email (no de verificación, que ya cubre la
    // librería): si se excede, no se manda el email, pero tampoco se avisa
    // nada distinto al caller — misma respuesta silenciosa que ya usa este
    // flujo para no revelar si la cuenta existe (ver recuperar-contrasena).
    if (ctx) {
      const { ok } = await rateLimiter.limit(ctx, "resetEmailSolicitado", { key: email });
      if (!ok) return;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Vibe CRM <no-reply@contalia.app>",
        to: email,
        subject: "Tu código para restablecer la contraseña",
        text: `Tu código es: ${token}\n\nVence en 10 minutos. Si no lo pediste, podés ignorar este mensaje.`,
      }),
    });
    if (!resp.ok) {
      throw new Error(`No se pudo enviar el email de reset: ${resp.status} ${await resp.text()}`);
    }
  },
});

/**
 * TODO(MID-7/MID-46): no hay registro público — las únicas cuentas válidas
 * las crea el bootstrap de convex/usuarios.ts (asegurarCredenciales) o un
 * login de Google cuyo email ya está en `usuarios` (ver
 * `callbacks.createOrUpdateUser` abajo), nunca un usuario final por su
 * cuenta. `profile` del provider Password se invoca en TODOS los flujos
 * (signIn, signUp, reset...), no solo al registrarse — por eso solo se
 * bloquea cuando flow === "signUp"; el signIn normal de una cuenta ya
 * existente no pasa por aquí.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (params.flow === "signUp") {
          throw new Error("El registro no está habilitado.");
        }
        return { email: params.email as string };
      },
      reset: resetPorCodigo,
    }),
    // El mapeo default de Auth.js descarta `email_verified` antes de que
    // llegue a `createOrUpdateUser` (`defaultProfile` en
    // @auth/core/lib/utils/providers.js solo copia id/name/email/image) —
    // este `profile()` lo conserva explícitamente, es lo único que hace.
    Google({
      profile(googleProfile) {
        return {
          id: googleProfile.sub,
          name: googleProfile.name,
          email: googleProfile.email,
          image: googleProfile.picture,
          emailVerified: googleProfile.email_verified === true,
        };
      },
    }),
  ],
  callbacks: {
    // MID-46: único punto con `ctx.db` que corre ANTES de crear cualquier
    // fila en `users`/`authAccounts`, para cualquier provider — "no
    // autorizado" tiene que significar cero rastro, no solo "sin sesión".
    // Al definirlo se reemplaza el comportamiento default para TODOS los
    // providers, así que cubre explícitamente los dos casos reales de esta
    // app (alta por password vía CLI, y login/alta por Google) en vez de
    // reimplementar genéricamente el linking de Convex Auth.
    async createOrUpdateUser(genericCtx, args) {
      // `genericCtx` llega tipado como `GenericMutationCtx<AnyDataModel>`
      // (firma genérica de Convex Auth, sin conocer nuestro schema) — se
      // castea al `MutationCtx` real de esta app para que `ctx.db` conozca
      // las tablas/índices de `convex/schema.ts` (mismo valor en runtime,
      // solo cambia el tipo).
      const ctx = genericCtx as unknown as MutationCtx;
      const email = typeof args.profile.email === "string" ? args.profile.email : undefined;

      if (args.type === "oauth") {
        // Las dos condiciones son necesarias: un email sin verificar no
        // prueba titularidad, y un email verificado pero no aprovisionado
        // tampoco es una cuenta válida del CRM (regla MID-7).
        if (!email || args.profile.emailVerified !== true) {
          throw new Error("No se pudo verificar el email de esta cuenta de Google.");
        }
        const usuario = await ctx.db
          .query("usuarios")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique();
        if (!usuario) {
          throw new Error("Esta cuenta de Google no está autorizada para acceder al CRM.");
        }
      }

      // Ya hay una cuenta de Auth vinculada (password creada por
      // `asegurarCredenciales`, o un login repetido con el mismo
      // provider) — solo refrescamos el email.
      if (args.existingUserId !== null) {
        if (email) {
          await ctx.db.patch(args.existingUserId, { email });
        }
        return args.existingUserId;
      }

      // Primera vez que se ve esta cuenta para ESTE provider: si ya existe
      // una fila de `users` con el mismo email (p. ej. ya tenía password y
      // esta es su primera vez con Google, o viceversa), se reutiliza en
      // vez de crear una identidad duplicada para la misma persona.
      if (email) {
        const existente = await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", email))
          .unique();
        if (existente) {
          return existente._id;
        }
      }
      // `emailVerificationTime` solo si la verificación fue realmente
      // comprobada (hallazgo de auditoría): para `"oauth"` ya se exigió
      // `emailVerified === true` más arriba; el provider de password no
      // verifica nada, así que nunca debe quedar marcado como verificado.
      const emailVerificado = args.type === "oauth" && email !== undefined;
      return await ctx.db.insert("users", {
        email,
        ...(emailVerificado ? { emailVerificationTime: Date.now() } : null),
      });
    },
  },
  jwt: {
    // El JWT de Convex Auth NO incluye el email por defecto (solo trae
    // `sub`) — sin esto, `ctx.auth.getUserIdentity().email` siempre es
    // `undefined` y `requireUsuario`/`usuarios.yo()` nunca encuentran la
    // fila de `usuarios` correspondiente, aunque la sesión sí sea válida.
    customClaims: async (ctx, { userId }) => {
      const user = await ctx.db.get(userId);
      return { email: user?.email };
    },
  },
});
