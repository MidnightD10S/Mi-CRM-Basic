import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import type { MutationCtx } from "./_generated/server";

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
