import {
  mutation,
  query,
  action,
  internalMutation,
  internalAction,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
  createAccount,
  retrieveAccount,
  modifyAccountCredentials,
  invalidateSessions,
  getAuthUserId,
  getAuthSessionId,
} from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { requireUsuario, requirePropietaria } from "./authHelpers";

/**
 * TODO(MID-7): la autenticación real ya existe (ver convex/auth.ts), pero el
 * registro público sigue bloqueado — las únicas cuentas válidas son las que
 * crea `asegurarCredenciales`/`crear` de abajo, no un usuario final.
 */

const USUARIOS_SEED = [
  { nombre: "Emiliana", email: "mbasiliosalinas@gmail.com", rol: "propietaria" as const },
  { nombre: "Marcelo", email: "marcelo@vibe-crm.local", rol: "comercial" as const },
];

/**
 * MID-9 (corrección de hallazgo de auditoría M2): antes era idempotente "por
 * email faltante" — eso resucitaba a cualquier persona del seed que se
 * hubiera borrado a propósito desde la pantalla de Equipo, ya que esta
 * mutation se llama en cada montaje de la app, sin sesión. Ahora solo siembra
 * si la tabla está completamente vacía (primer arranque real del
 * deployment): una vez que el negocio tiene al menos una persona real, nunca
 * vuelve a crear nada, y borrar a alguien queda definitivo.
 */
export const asegurarSeed = mutation({
  args: {},
  handler: async (ctx) => {
    const yaHayAlguien = await ctx.db.query("usuarios").first();
    if (yaHayAlguien) return;
    for (const persona of USUARIOS_SEED) {
      await ctx.db.insert("usuarios", persona);
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
 * MID-9: versión completa de `listar`, solo para la pantalla de Equipo —
 * expone `email` porque la Dueña lo necesita (lista + precarga de edición).
 */
export const listarEquipo = query({
  args: {},
  handler: async (ctx) => {
    await requirePropietaria(ctx);
    const usuarios = await ctx.db.query("usuarios").collect();
    return usuarios.map((usuario) => ({
      _id: usuario._id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    }));
  },
});

function contarPropietarias(usuarios: { rol: "propietaria" | "comercial" }[]) {
  return usuarios.filter((u) => u.rol === "propietaria").length;
}

// Mismo chequeo de forma (no RFC 5322 completo) que ya usa `clientes.ts` —
// se duplica la constante en vez de compartir un módulo: dos archivos no
// justifican todavía una abstracción nueva.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * MID-9: alta de una persona nueva — solo la Dueña. Hace la parte de
 * `usuarios` + decide si hay que aprovisionar login por contraseña; el envío
 * de email real lo hace la `action` pública `crear`, de abajo, que es la que
 * puede hacer `fetch` a Resend y llamar `createAccount`.
 */
export const _crearInterno = internalMutation({
  args: {
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  },
  handler: async (ctx, { nombre, email, rol }) => {
    await requirePropietaria(ctx);
    const existente = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    const cuentaPasswordPrevia = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email)
      )
      .unique();

    if (existente) {
      // Si ya tiene una identidad de Auth real (cuenta de password, o ya
      // logueó alguna vez y tiene `authUserId`), es una persona ya dada de
      // alta — colisión real.
      if (existente.authUserId !== undefined || cuentaPasswordPrevia !== null) {
        throw new Error(`Ya hay una persona del equipo con el email ${email}.`);
      }
      // Si no, es el reintento de un alta anterior que falló DESPUÉS de
      // crear la fila de negocio pero ANTES de aprovisionar la cuenta
      // (hallazgo de auditoría, sugerencia no bloqueante) — se reutiliza la
      // fila en vez de bloquear el reintento.
      await ctx.db.patch(existente._id, { nombre, rol });
    } else {
      await ctx.db.insert("usuarios", { nombre, email, rol });
    }

    // ¿Ese email ya tiene cuenta de password en este CRM (reingreso de
    // alguien que ya fue usuario antes)? Si la tiene, no se toca nada de
    // Auth ni se pisa su contraseña.
    return { yaTeniaCuenta: cuentaPasswordPrevia !== null };
  },
});

async function enviarEmailResend(opts: { to: string; subject: string; text: string }) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: "Vibe CRM <no-reply@contalia.app>", ...opts }),
  });
  if (!resp.ok) {
    throw new Error(`No se pudo enviar el email: ${resp.status} ${await resp.text()}`);
  }
}

/**
 * MID-9: alta real, invocable desde la pantalla de Equipo. `action` (no
 * `mutation`) porque necesita poder crear la cuenta de password
 * (`createAccount`, solo disponible en acciones) y mandar el email por
 * Resend (`fetch`, tampoco disponible en una mutation).
 *
 * Corrección de hallazgo de auditoría M1: `nombre`/`email` se recortan y
 * validan UNA sola vez, acá, al principio — antes de tocar nada. Los
 * valores ya normalizados (`nombreLimpio`/`emailLimpio`) son los que se
 * usan en las tres llamadas que siguen (`_crearInterno`, `createAccount`,
 * `enviarEmailResend`), nunca los `args` crudos: si cada una normalizara
 * por su cuenta, la fila de `usuarios` y la cuenta de login podrían
 * terminar con un email ligeramente distinto (p. ej. con espacios), y esa
 * persona quedaría sin poder loguearse.
 */
export const crear = action({
  args: {
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
  },
  handler: async (ctx: ActionCtx, { nombre, email, rol }) => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      throw new Error("El nombre no puede estar vacío.");
    }
    const emailLimpio = email.trim();
    if (!EMAIL_REGEX.test(emailLimpio)) {
      throw new Error("El email no tiene un formato válido.");
    }

    const { yaTeniaCuenta } = await ctx.runMutation(internal.usuarios._crearInterno, {
      nombre: nombreLimpio,
      email: emailLimpio,
      rol,
    });

    if (!yaTeniaCuenta) {
      // Contraseña aleatoria, nunca mostrada a nadie — la persona la
      // configura ella misma al abrir el link de invitación, reusando el
      // flujo de código por email ya construido en MID-44
      // (/recuperar-contrasena → /restablecer-contrasena). `createOrUpdateUser`
      // (convex/auth.ts) ya deja sincronizado `usuarios.authUserId` apenas
      // esta llamada crea la fila de `users`.
      //
      // A diferencia de `asegurarCredenciales` (donde un fallo de
      // `createAccount` es ambiguo porque podría ser una cuenta ya creada en
      // una corrida anterior), acá `_crearInterno` ya confirmó un instante
      // antes que no existía ninguna cuenta de password para este email —
      // así que si `createAccount` lanza, es un error real (no una carrera
      // esperable) y no hay que tragarlo: mandar la invitación igual dejaría
      // a la persona con un link que nunca puede completar, porque no
      // existiría ninguna cuenta para resetear (hallazgo de auditoría,
      // sugerencia no bloqueante).
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const passwordAleatoria = btoa(String.fromCharCode(...bytes));
      await createAccount(ctx, {
        provider: "password",
        account: { id: emailLimpio, secret: passwordAleatoria },
        profile: { email: emailLimpio },
      });
    }

    const sitio = process.env.SITE_URL ?? "";
    let invitado = true;
    try {
      if (yaTeniaCuenta) {
        // Ya tiene contraseña de este CRM — directo al login normal, sin
        // pasar por el flujo de configurar una nueva.
        await enviarEmailResend({
          to: emailLimpio,
          subject: "Te sumaron de nuevo al equipo de Vibe CRM",
          text: `Hola ${nombreLimpio},\n\nTe volvieron a sumar al equipo de Vibe CRM. Ya podés iniciar sesión con tu contraseña existente:\n${sitio}/login\n`,
        });
      } else {
        // Directo al paso 1 de "recuperar contraseña" (MID-44, reusado como
        // "configurar por primera vez") — no al login, para no hacerle dar
        // una vuelta de más a alguien que todavía no tiene contraseña.
        await enviarEmailResend({
          to: emailLimpio,
          subject: "Te invitaron a unirte al equipo de Vibe CRM",
          text: `Hola ${nombreLimpio},\n\nTe invitaron a unirte al equipo de Vibe CRM. Ingresá a este link con tu email para que te mandemos un código y puedas crear tu contraseña:\n${sitio}/recuperar-contrasena?invitacion=1\n`,
        });
      }
    } catch {
      invitado = false;
    }

    return { invitado };
  },
});

/**
 * MID-9: editar nombre/rol de otra persona — solo la Dueña. Cambiar el email
 * de otra persona se deja fuera (igual criterio que `editarMiPerfil`, ver
 * abajo): requeriría la misma sincronización de 3 tablas que
 * `migrarEmailUsuario`, sin verificación de titularidad del email nuevo.
 */
export const editar = mutation({
  args: {
    usuarioId: v.id("usuarios"),
    nombre: v.optional(v.string()),
    rol: v.optional(v.union(v.literal("propietaria"), v.literal("comercial"))),
  },
  handler: async (ctx, { usuarioId, nombre, rol }) => {
    await requirePropietaria(ctx);
    const objetivo = await ctx.db.get(usuarioId);
    if (!objetivo) throw new Error("Ese usuario ya no existe.");

    // "No puede quedar el negocio sin ninguna Dueña" aplica igual al cambio
    // de rol que al borrado (decisión confirmada con el usuario, ver plan).
    if (rol !== undefined && rol !== objetivo.rol && objetivo.rol === "propietaria") {
      const todos = await ctx.db.query("usuarios").collect();
      if (contarPropietarias(todos) <= 1) {
        throw new Error("No puede quedar el negocio sin ninguna Dueña.");
      }
    }

    const cambios: Partial<{ nombre: string; rol: "propietaria" | "comercial" }> = {};
    if (nombre !== undefined) {
      const nombreLimpio = nombre.trim();
      if (!nombreLimpio) throw new Error("El nombre no puede estar vacío.");
      cambios.nombre = nombreLimpio;
    }
    if (rol !== undefined) cambios.rol = rol;
    if (Object.keys(cambios).length > 0) {
      await ctx.db.patch(usuarioId, cambios);
    }
  },
});

/**
 * MID-9 (corrección de hallazgo de auditoría M4): la limpieza de
 * `authAccounts`/`users` corre en esta mutation (puede usar `ctx.db`); la
 * invalidación de `authSessions`/`authRefreshTokens` corre en la `action`
 * pública `eliminar`, de abajo, porque `invalidateSessions` solo está
 * disponible fuera de una mutation.
 */
export const _eliminarInterno = internalMutation({
  args: { usuarioId: v.id("usuarios") },
  handler: async (ctx, { usuarioId }) => {
    const quien = await requirePropietaria(ctx);
    if (quien._id === usuarioId) {
      throw new Error("No podés eliminarte a ti misma.");
    }
    const objetivo = await ctx.db.get(usuarioId);
    if (!objetivo) throw new Error("Ese usuario ya no existe.");

    if (objetivo.rol === "propietaria") {
      const todos = await ctx.db.query("usuarios").collect();
      if (contarPropietarias(todos) <= 1) {
        throw new Error("No puede quedar el negocio sin ninguna Dueña.");
      }
    }

    await ctx.db.delete(usuarioId);

    const authUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", objetivo.email))
      .unique();
    if (!authUser) return { authUserId: null };

    const cuentas = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", authUser._id))
      .collect();
    for (const cuenta of cuentas) {
      await ctx.db.delete(cuenta._id);
    }
    await ctx.db.delete(authUser._id);
    return { authUserId: authUser._id };
  },
});

/**
 * MID-9: borrado real, invocable desde la pantalla de Equipo. `action` (no
 * `mutation`) porque necesita `invalidateSessions` para que una sesión ya
 * emitida para esta persona no pueda seguir renovándose — el cierre real del
 * hallazgo M4 es el chequeo de `usuarios.authUserId` en `requireUsuario`
 * (convex/authHelpers.ts), esto es higiene adicional, no lo único que lo
 * resuelve.
 */
export const eliminar = action({
  args: { usuarioId: v.id("usuarios") },
  handler: async (ctx: ActionCtx, { usuarioId }) => {
    const { authUserId } = await ctx.runMutation(internal.usuarios._eliminarInterno, {
      usuarioId,
    });
    if (authUserId) {
      await invalidateSessions(ctx, { userId: authUserId });
    }
  },
});

/**
 * MID-8: "Editar mis datos" — solo `nombre`. No incluye `email` (corrección
 * de hallazgo de auditoría M3): cambiar el propio email de login sin
 * verificar que la persona controla esa casilla podría transferir el acceso
 * a quien sí la controle, vía el allowlist de Google OAuth (que autoriza por
 * email contra `usuarios`). Queda fuera de este alcance.
 */
export const editarMiPerfil = mutation({
  args: { nombre: v.string() },
  handler: async (ctx, { nombre }) => {
    const usuario = await requireUsuario(ctx);
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) throw new Error("El nombre no puede estar vacío.");
    await ctx.db.patch(usuario._id, { nombre: nombreLimpio });
  },
});

export const _requireUsuarioInterno = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireUsuario(ctx);
  },
});

/**
 * MID-8: "Cambiar contraseña", verificando la contraseña actual antes de
 * fijar la nueva. `modifyAccountCredentials`/`retrieveAccount` son de
 * `@convex-dev/auth/server`, solo disponibles en una `action`.
 */
export const cambiarContrasena = action({
  args: { contrasenaActual: v.string(), contrasenaNueva: v.string() },
  handler: async (ctx: ActionCtx, { contrasenaActual, contrasenaNueva }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) throw new Error("No autenticado.");
    // Defensa en profundidad: exige también una fila de negocio válida para
    // este email (mismo criterio que `requireUsuario`, desde un contexto de
    // acción que no tiene `ctx.db` directo).
    await ctx.runQuery(internal.usuarios._requireUsuarioInterno, {});

    if (contrasenaNueva.length < 8) {
      throw new Error("La contraseña nueva debe tener al menos 8 caracteres.");
    }

    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: identity.email, secret: contrasenaActual },
      });
    } catch {
      throw new Error("La contraseña actual no es correcta.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: identity.email, secret: contrasenaNueva },
    });

    // Sugerencia de auditoría (no bloqueante): si alguien cambia su
    // contraseña porque sospecha que otra persona la conoce, esa otra
    // sesión (ya autenticada en otro dispositivo/navegador) debe perder el
    // acceso — `modifyAccountCredentials` por sí solo no la invalida.
    // `except` conserva la sesión actual, para no desloguear a quien recién
    // hizo el cambio.
    const authUserId = await getAuthUserId(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (authUserId) {
      await invalidateSessions(ctx, {
        userId: authUserId,
        except: sessionId ? [sessionId] : undefined,
      });
    }
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

/**
 * MID-9 (corrección de hallazgo de auditoría M5): `requireUsuario` empezó a
 * exigir `usuarios.authUserId` el mismo día en que se agregó el campo —
 * toda cuenta que ya existiera ANTES de este deploy (Emiliana, Marcelo)
 * todavía no lo tiene, porque solo se completa dentro de `createOrUpdateUser`
 * (convex/auth.ts), que corre al iniciar sesión, no retroactivamente. Sin
 * esta migración, esas cuentas quedarían bloqueadas de toda acción de
 * negocio hasta volver a loguearse — y lo verían como un error de carga
 * genérico (`AppErrorBoundary`), no como "iniciá sesión de nuevo".
 *
 * Se ejecuta a mano, una sola vez por deployment, INMEDIATAMENTE después de
 * `npx convex deploy` de este cambio (antes de que nadie use la app):
 *   npx convex run usuarios:_backfillAuthUserId
 * (y de nuevo con `--prod` tras desplegar a producción).
 */
export const _backfillAuthUserId = internalMutation({
  args: {},
  handler: async (ctx) => {
    const usuarios = await ctx.db.query("usuarios").collect();
    let vinculados = 0;
    let sinCuentaDeAuth = 0;
    for (const usuario of usuarios) {
      if (usuario.authUserId !== undefined) continue;
      const authUser = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", usuario.email))
        .unique();
      if (!authUser) {
        sinCuentaDeAuth++;
        continue;
      }
      await ctx.db.patch(usuario._id, { authUserId: authUser._id });
      vinculados++;
    }
    return { vinculados, sinCuentaDeAuth };
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
