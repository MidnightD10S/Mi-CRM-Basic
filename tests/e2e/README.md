# MID-25 — Suite end-to-end

Automatiza los 4 recorridos del PRD (`tests/e2e/recorridos.spec.ts`) contra
`http://localhost:3100` (`next dev`) y el deployment de desarrollo de Convex
(`npx convex dev`), que deben estar corriendo antes de ejecutar la suite.

## Requisito: `convex/_scratchTestUser.ts`

Esta suite necesita que exista `convex/_scratchTestUser.ts` en el
deployment de desarrollo — un archivo **ad-hoc que nunca se commitea**
(mismo criterio que los scripts de credenciales de MID-7), porque son
funciones `internal` con permiso de borrado amplio (gated por
`assertDevDeployment()`, que aborta fuera del deployment de desarrollo
esperado) y no tiene sentido que queden desplegadas permanentemente en el
código del negocio. Para que quede revisable sin commitearlo como función
viva, su contenido exacto está pegado abajo — copiarlo tal cual a
`convex/_scratchTestUser.ts` si el archivo no existe.

**Contraseña**: `crearCuentaYFixtures` genera una contraseña aleatoria en
cada corrida (nunca una fija) y `globalSetup` la escribe en
`tests/e2e/.e2e-credentials.local.json` (gitignored); `globalTeardown` la
borra al terminar. Los specs la leen de ahí en tiempo de ejecución
(`leerPasswordE2E()` en `fixtures.ts`), nunca como constante versionada.

```ts
// convex/_scratchTestUser.ts
// MID-25 — ad-hoc, NUNCA se commitea (mismo criterio que los *.local.* ya
// usados para credenciales de desarrollo). Usuario + fixtures de negocio
// para la suite de Playwright de tests/e2e/. Su contenido exacto está
// embebido en tests/e2e/README.md como artefacto de solo lectura — copiarlo
// de ahí para recrear este archivo si no existe.
//
// Namespace fijo y estable (no generado por corrida): el mismo email y el
// mismo marcador de `nota` en todas las ejecuciones, de una sesión a la
// siguiente — ver el plan aprobado, hallazgos #14 y #16, sobre por qué un
// identificador por corrida no sirve para que una limpieza de "red de
// seguridad" (que corre ANTES de que exista cualquier ID de la corrida
// actual) pueda encontrar los restos de una corrida anterior interrumpida.
// La CONTRASEÑA, en cambio, es aleatoria en cada corrida (hallazgo de
// auditoría externa: una contraseña fija, aunque solo viva en un archivo no
// commiteado, es un secreto reutilizable; generarla de nuevo cada vez quita
// esa superficie por completo) — nunca se devuelve a quien no la generó.
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

const EMAIL = "e2e-qa@vibe-crm.local";
// Único criterio real de borrado (hallazgo #16): un prefijo de `nombre` no
// alcanza, porque un cliente real de desarrollo podría coincidir por azar.
// `nota` es un campo libre que ningún flujo real de la UI usa con este
// valor exacto.
const NOTA_SENTINEL = "[E2E-QA-FIXTURE]";
// Solo para que los fixtures sean reconocibles a simple vista en la UI
// mientras se depura — nunca el criterio de borrado.
const NOMBRE_PREFIJO = "[E2E] ";

// Mismo generador que `convex/usuarios.ts` (`generarSecretoAleatorio`): Web
// Crypto del runtime de Convex, nunca Math.random().
function generarSecretoAleatorio(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Comparación EXACTA del deployment (hallazgo #15) — nunca `.includes()`,
 * que podría dar un falso positivo ante un nombre de deployment que
 * casualmente contenga la subcadena esperada. Si `CONVEX_SITE_URL` falta o
 * no es exactamente el deployment de desarrollo conocido, aborta sin tocar
 * nada.
 */
function assertDevDeployment() {
  const url = process.env.CONVEX_SITE_URL;
  if (!url) throw new Error("CONVEX_SITE_URL no está definida — abortado sin borrar nada.");
  const slug = new URL(url).hostname.split(".")[0];
  if (slug !== "formal-dotterel-607") {
    throw new Error(
      `Este no es el deployment de desarrollo esperado (es "${slug}") — abortado sin borrar nada.`
    );
  }
}

/**
 * Fixtures de negocio (hallazgos #8/#9 de la 3ª auditoría): la fila de
 * `usuarios` que `requireUsuario`/`usuarios.yo()` necesitan para resolver
 * la sesión, más los dos clientes que los recorridos 1 y 3 del PRD
 * presuponen (uno con un seguimiento ya vencido, otro con una interacción
 * previa). `ctx.db.insert` directo, no las mutations públicas de
 * `clientes.ts`/`seguimientos.ts`/`interacciones.ts` — esas no exponen todos
 * los campos que un fixture necesita (p. ej. un seguimiento ya vencido).
 */
export const sembrarFixtures = internalMutation({
  args: {},
  handler: async (ctx) => {
    assertDevDeployment();

    const usuario = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", EMAIL))
      .unique();
    const usuarioId =
      usuario?._id ??
      (await ctx.db.insert("usuarios", { nombre: "QA E2E", email: EMAIL, rol: "comercial" }));

    const ahora = Date.now();
    const unDiaMs = 24 * 60 * 60 * 1000;

    const clienteUnoId = await ctx.db.insert("clientes", {
      nombre: `${NOMBRE_PREFIJO}Cliente Uno`,
      nota: NOTA_SENTINEL,
      estado: "nuevo_lead",
      creadoEn: ahora,
    });
    // Ya vencido — el recorrido 1 necesita verlo bajo "Atrasados" en Hoy.
    await ctx.db.insert("seguimientos", {
      clienteId: clienteUnoId,
      accion: "Llamar para retomar el contacto",
      vence: ahora - unDiaMs,
      hecho: false,
      responsableId: usuarioId,
    });

    const clienteDosId = await ctx.db.insert("clientes", {
      nombre: `${NOMBRE_PREFIJO}Cliente Dos`,
      nota: NOTA_SENTINEL,
      estado: "en_negociacion",
      creadoEn: ahora,
    });
    // Historial previo — el recorrido 3 necesita "de qué hablaron la
    // última vez" al abrir la ficha.
    await ctx.db.insert("interacciones", {
      clienteId: clienteDosId,
      tipo: "llamada",
      nota: "Primer contacto: interesado en el plan anual, pidió una propuesta por escrito.",
      fecha: ahora - unDiaMs,
      autorId: usuarioId,
    });

    return { usuarioId, clienteUnoId, clienteDosId };
  },
});

/**
 * Identidad de Auth + fixtures de negocio, en dos funciones separadas
 * (hallazgo #10 — una `action` no tiene `ctx.db` directo), mismo patrón que
 * `asegurarCredenciales` en `convex/usuarios.ts`. `globalSetup`
 * (tests/e2e/global-setup.ts) siempre corre `limpiarTodo` justo antes de
 * esta función, así que la cuenta no debería existir todavía — si
 * `createAccount` igual lanza, es una señal real de que esa barrida no
 * limpió como se esperaba, y se deja que falle en vez de enmascararlo.
 */
export const crearCuentaYFixtures = internalAction({
  args: {},
  handler: async (ctx) => {
    assertDevDeployment();

    const password = generarSecretoAleatorio();
    await createAccount(ctx, {
      provider: "password",
      account: { id: EMAIL, secret: password },
      profile: { email: EMAIL },
    });
    await retrieveAccount(ctx, { provider: "password", account: { id: EMAIL, secret: password } });
    await ctx.runMutation(internal._scratchTestUser.sembrarFixtures, {});

    return { email: EMAIL, password };
  },
});

/**
 * Recorrido 4 del PRD (hallazgo #11 de la 4ª auditoría): "sin atrasados" no
 * se puede verificar solo desde la UI global de Hoy (podría haber atrasados
 * reales/ajenos de pruebas manuales anteriores). Esta query responde la
 * pregunta solo sobre los datos de esta suite (clientes marcados con el
 * sentinel exacto de `nota`), como aserción de datos previa a la de UI.
 */
export const hayAtrasadosPendientes = internalQuery({
  args: {},
  handler: async (ctx) => {
    assertDevDeployment();
    const clientes = await ctx.db.query("clientes").collect();
    const marcados = clientes.filter((cliente) => cliente.nota === NOTA_SENTINEL);
    const ahora = Date.now();
    for (const cliente of marcados) {
      const seguimientos = await ctx.db
        .query("seguimientos")
        .withIndex("by_cliente", (q) => q.eq("clienteId", cliente._id))
        .collect();
      if (seguimientos.some((seguimiento) => !seguimiento.hecho && seguimiento.vence < ahora)) {
        return true;
      }
    }
    return false;
  },
});

/**
 * Limpieza completa (sin argumentos — descubre todo por el namespace fijo,
 * hallazgo #14): cubre las 7 tablas de `authTables` involucradas con una
 * cuenta Password (hallazgo #6) más todo el negocio que cuelgue de los
 * clientes marcados con el sentinel exacto de `nota` (hallazgo #16) — la
 * cascada por `clienteId` cubre tanto los fixtures sembrados como
 * cualquier interacción/seguimiento creado en vivo durante un recorrido.
 * Pura `ctx.db.delete`, sin ninguna `action` envolvente (hallazgo #10).
 */
export const limpiarTodo = internalMutation({
  args: {},
  handler: async (ctx) => {
    assertDevDeployment();

    // --- Negocio: clientes marcados y todo lo que cuelga de ellos -------
    const clientes = await ctx.db.query("clientes").collect();
    const marcados = clientes.filter((cliente) => cliente.nota === NOTA_SENTINEL);
    for (const cliente of marcados) {
      const interacciones = await ctx.db
        .query("interacciones")
        .withIndex("by_cliente", (q) => q.eq("clienteId", cliente._id))
        .collect();
      for (const interaccion of interacciones) await ctx.db.delete(interaccion._id);

      const seguimientos = await ctx.db
        .query("seguimientos")
        .withIndex("by_cliente", (q) => q.eq("clienteId", cliente._id))
        .collect();
      for (const seguimiento of seguimientos) await ctx.db.delete(seguimiento._id);

      const ventas = await ctx.db
        .query("ventas")
        .withIndex("by_cliente", (q) => q.eq("clienteId", cliente._id))
        .collect();
      for (const venta of ventas) await ctx.db.delete(venta._id);

      await ctx.db.delete(cliente._id);
    }

    // --- Fila de negocio en `usuarios` -----------------------------------
    const usuarioNegocio = await ctx.db
      .query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", EMAIL))
      .unique();
    if (usuarioNegocio) await ctx.db.delete(usuarioNegocio._id);

    // --- Identidad completa de Convex Auth (hallazgo #6) -----------------
    const authUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", EMAIL))
      .unique();
    if (authUser) {
      const sesiones = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", authUser._id))
        .collect();
      for (const sesion of sesiones) {
        const refreshTokens = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", sesion._id))
          .collect();
        for (const token of refreshTokens) await ctx.db.delete(token._id);
        await ctx.db.delete(sesion._id);
      }

      const cuentas = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", authUser._id))
        .collect();
      for (const cuenta of cuentas) {
        const codigos = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", cuenta._id))
          .collect();
        for (const codigo of codigos) await ctx.db.delete(codigo._id);
        await ctx.db.delete(cuenta._id);
      }

      await ctx.db.delete(authUser._id);
    }

    // El provider Password de este repo no usa PKCE (eso es solo OAuth), así
    // que `authVerifiers` no debería tener filas de esta cuenta — no hay
    // nada reconocible por lo que buscarlas (sin relación directa a
    // userId/email), se deja constancia en vez de adivinar.
    const rateLimits = await ctx.db
      .query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", EMAIL))
      .collect();
    for (const limite of rateLimits) await ctx.db.delete(limite._id);
  },
});
```

## Correr la suite

```
npm run test:e2e
```

`globalSetup` corre una barrida de limpieza (red de seguridad, por si una
corrida anterior quedó interrumpida), siembra la cuenta + los fixtures
frescos (con una contraseña nueva cada vez) y escribe esa contraseña en
`tests/e2e/.e2e-credentials.local.json` (gitignored). `globalTeardown` corre
la misma limpieza al final y borra ese archivo. Los 4 recorridos corren en
serie (`workers: 1`, `test.describe.serial`), en un único spec, porque
comparten datos y dependen entre sí en el orden fijo del PRD.
