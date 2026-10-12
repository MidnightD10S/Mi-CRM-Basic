import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

/**
 * TODO(MID-7): no hay registro público — las únicas cuentas válidas las crea
 * el bootstrap de convex/usuarios.ts (asegurarCredenciales), no un usuario
 * final. `profile` se invoca en TODOS los flujos (signIn, signUp, reset...),
 * no solo al registrarse — por eso solo se bloquea cuando flow === "signUp";
 * el signIn normal de una cuenta ya existente no pasa por aquí.
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
  ],
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
