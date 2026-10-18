import { mutation, query, internalMutation, internalAction, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { requireUsuario } from "./authHelpers";

/**
 * TODO(MID-7): la autenticación real ya existe (ver convex/auth.ts), pero el
 * registro público sigue bloqueado — las únicas cuentas válidas son las que
 * crea `asegurarCredenciales` de abajo, no un usuario final.
 */

const USUARIOS_SEED = [
  { nombre: "Emiliana", email: "mbasiliosalinas@gmail.com", rol: "propietaria" as const },
  { nombre: "Marcelo", email: "marcelo@vibe-crm.local", rol: "comercial" as const },
];

/**
 * Idempotente por email, no por "tabla vacía": una tabla parcialmente poblada
 * (p. ej. solo existe Marcelo) no deja a nadie sin crear. Seguro de llamar en
 * cualquier estado del deployment. Sin `requireUsuario`: se llama al montar
 * la app, antes de que exista sesión, y no lee ni devuelve datos sensibles.
 */
export const asegurarSeed = mutation({
  args: {},
  handler: async (ctx) => {
    for (const persona of USUARIOS_SEED) {
      const existente = await ctx.db
        .query("usuarios")
        .withIndex("by_email", (q) => q.eq("email", persona.email))
        .unique();
      if (!existente) {
        await ctx.db.insert("usuarios", persona);
      }
    }
  },
});

/**
 * Sesión real (MID-7): lee la identidad autenticada de `ctx.auth`, nunca un
 * email pasado por el cliente. No lanza si no hay sesión — devuelve `null`,
 * porque la propia pantalla de login/sesión necesita poder llamarla sin
 * estar autenticado para saber que no hay sesión.
 */
export const yo = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) return null;
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();
    return usuario ? { _id: usuario._id, nombre: usuario.nombre, rol: usuario.rol } : null;
  },
});

export const listar = query({
  args: {},
  handler: async (ctx) => {
    await requireUsuario(ctx);
    const usuarios = await ctx.db.query("usuarios").collect();
    // Recorte a los campos que la UI necesita (p. ej. resolver
    // responsableId → nombre), sin exponer el email de cada usuario.
    return usuarios.map((usuario) => ({
      _id: usuario._id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    }));
  },
});

/**
 * MID-46: migra el email de una persona ya aprovisionada, de forma atómica,
 * en las tres filas que determinan si el login funciona — cambiar solo
 * `usuarios.email` deja autenticando con éxito pero sin autorización (el
 * JWT seguiría llevando el email viejo vía `users.email`), y cambiar solo
 * eso además rompería el login por contraseña existente (que busca la
 * cuenta por `authAccounts.providerAccountId`, no por `usuarios.email`).
 * Se ejecuta a mano, una vez por deployment:
 *   npx convex run usuarios:migrarEmailUsuario '{"emailViejo":"...","emailNuevo":"..."}'
 */
export const migrarEmailUsuario = internalMutation({
  args: { emailViejo: v.string(), emailNuevo: v.string() },
  handler: async (ctx, { emailViejo, emailNuevo }) => {
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", emailViejo))
      .unique();
    if (!usuario) {
      throw new Error(`No hay un usuario con email ${emailViejo}.`);
    }
    // Preflight en las tres tablas: `requireUsuario`/el login usan
    // `.unique()` — un duplicado en cualquiera de ellas rompería la
    // resolución de identidad para cualquiera de las dos cuentas.
    const usuarioColision = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", emailNuevo))
      .unique();
    if (usuarioColision) {
      throw new Error(`Ya existe un usuario con email ${emailNuevo}.`);
    }

    const authUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", emailViejo))
      .unique();
    if (!authUser) {
      throw new Error(`No hay cuenta de Auth con email ${emailViejo}.`);
    }
    const authUserColision = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", emailNuevo))
      .unique();
    if (authUserColision) {
      throw new Error(`Ya existe una cuenta de Auth con email ${emailNuevo}.`);
    }

    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", emailViejo)
      )
      .unique();
    const authAccountColision = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", emailNuevo)
      )
      .unique();
    if (authAccountColision) {
      throw new Error(`Ya existe una cuenta de password con email ${emailNuevo}.`);
    }

    await ctx.db.patch(usuario._id, { email: emailNuevo });
    await ctx.db.patch(authUser._id, { email: emailNuevo });
    // No se exige que exista: cubre a alguien que todavía no tenga
    // credencial de password provisionada.
    if (authAccount) {
      await ctx.db.patch(authAccount._id, { providerAccountId: emailNuevo });
    }
  },
});

// --- Bootstrap de credenciales iniciales (MID-7, solo desarrollo) ---------

const UMBRAL_ABANDONO_MS = 5 * 60 * 1000; // 5 minutos

// Generador criptográfico del runtime por defecto de Convex (Web Crypto, sin
// necesitar "use node"); nunca Math.random().
function generarSecretoAleatorio(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Reclamo atómico con reconciliación de abandono (ver plan MID-7): decide y
 * persiste todo (incluida la contraseña, si es nueva) en una sola
 * transacción, para que nunca exista un momento en que "ya decidimos usar
 * esta contraseña" pero todavía no esté guardada.
 */
export const _prepararCredencial = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!usuario) return { accion: "sin_usuario" as const };

    const c = usuario.credencial;
    if (c?.estado === "creada") return { accion: "ya_confirmada" as const };
    const abandonado = c?.estado === "creando" && Date.now() - c.reclamadoEn > UMBRAL_ABANDONO_MS;
    if (c?.estado === "creando" && !abandonado) {
      return { accion: "en_curso" as const }; // otra ejecución activa, no tocar
    }

    const token = generarSecretoAleatorio();
    // Reutiliza la contraseña ya persistida si la había (reconciliación de un
    // reclamo abandonado o reintento tras verificación fallida); solo genera
    // una nueva si no había ningún reclamo previo.
    const password = c?.estado === "creando" ? c.password : generarSecretoAleatorio();
    await ctx.db.patch(usuario._id, {
      credencial: { estado: "creando", reclamadoEn: Date.now(), token, password },
    });
    return { accion: "intentar" as const, password, token };
  },
});

/**
 * Solo confirma si el `token` recibido coincide con el guardado — una
 * ejecución vieja que despierta tarde no puede confirmar sobre el reclamo de
 * una más nueva. Al confirmar, el documento deja de tener `password` en
 * absoluto (unión discriminada en el esquema): no se conserva texto plano
 * una vez verificada la cuenta.
 */
export const _confirmarCredencialCreada = internalMutation({
  args: { email: v.string(), token: v.string() },
  handler: async (ctx, { email, token }) => {
    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (usuario?.credencial?.estado === "creando" && usuario.credencial.token === token) {
      await ctx.db.patch(usuario._id, { credencial: { estado: "creada" } });
    }
  },
});

async function verificarCredencial(ctx: ActionCtx, email: string, password: string) {
  try {
    // A diferencia de `signIn`, `retrieveAccount` no crea ninguna sesión —
    // solo confirma que la cuenta existe y que el secreto coincide, que es
    // todo lo que el bootstrap necesita saber. Nunca se infiere el resultado
    // a partir de si `createAccount` lanzó o no (ver nota abajo).
    await retrieveAccount(ctx, { provider: "password", account: { id: email, secret: password } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Bootstrap de las 2 cuentas conocidas del negocio — exclusivo de
 * desarrollo, sin proveedor de email ni registro público. `internalAction`
 * (no `action`): no aparece bajo `api.usuarios`, así que no es invocable
 * desde `ConvexReactClient` ni ningún código de la UI — solo desde
 * `npx convex run`, que tiene acceso de administrador al deployment.
 *
 * Ejecutar manualmente una sola vez:
 *   npx convex run usuarios:asegurarCredenciales > <archivo fuera del repo y
 *   fuera de OneDrive> — nunca pegar la salida en un chat.
 */
export const asegurarCredenciales = internalAction({
  args: {},
  handler: async (ctx) => {
    const creadas: Record<string, string> = {};
    const errores: Record<string, string> = {};

    for (const persona of USUARIOS_SEED) {
      const resultado = await ctx.runMutation(internal.usuarios._prepararCredencial, {
        email: persona.email,
      });
      if (resultado.accion === "en_curso" || resultado.accion === "sin_usuario") continue;
      if (resultado.accion === "ya_confirmada") continue; // ya se entregó en una corrida anterior

      const { password, token } = resultado;
      try {
        await createAccount(ctx, {
          provider: "password",
          account: { id: persona.email, secret: password },
          profile: { email: persona.email },
        });
      } catch {
        // No concluyente por sí solo — la decisión real la toma la
        // verificación de abajo, no esta excepción (un fallo aquí puede
        // deberse a que la cuenta ya existe con esta misma contraseña
        // reutilizada, o a un problema real; solo `retrieveAccount` lo sabe).
      }

      if (await verificarCredencial(ctx, persona.email, password)) {
        await ctx.runMutation(internal.usuarios._confirmarCredencialCreada, {
          email: persona.email,
          token,
        });
        creadas[persona.email] = password;
      } else {
        errores[persona.email] =
          "No se pudo confirmar todavía; se reintentará con la misma contraseña en la próxima corrida.";
      }
    }

    return { creadas, errores };
  },
});
