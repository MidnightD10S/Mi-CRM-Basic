import { test, expect, type Page } from "playwright/test";
import { convexRunJson } from "./convex-cli";
import {
  E2E_EMAIL,
  E2E_PASSWORD,
  NOMBRE_CLIENTE_UNO,
  NOMBRE_CLIENTE_DOS,
  NOMBRE_CLIENTE_TRES,
  NOTA_SENTINEL,
} from "./fixtures";

/**
 * MID-25: los 4 recorridos del PRD, en este orden fijo y en un único spec
 * (`test.describe.serial`) — comparten el usuario y los fixtures de
 * `convex/_scratchTestUser.ts` (sembrados por `globalSetup`) y dependen
 * entre sí: el recorrido 1 deja el seguimiento atrasado original marcado
 * como hecho, y el recorrido 4 verifica justamente eso. Ver
 * tests/e2e/README.md para el ciclo de vida completo.
 */

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  await page.locator("#login-password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(hoy|clientes|ventas)/);
}

/** YYYY-MM-DD en horario LOCAL — `toISOString()` convierte a UTC y puede
 * correr la fecha un día cerca de medianoche, que es justo el tipo de bug
 * que esta suite debería poder detectar, no introducir en sí misma. */
function fechaLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/**
 * El Overlay (MID-24) sigue montado durante su animación de cierre
 * (`phase: "closing"`) — justo después de un clic en "Guardar", el
 * `<textarea>`/`<input>` con el texto recién tipeado todavía está en el DOM
 * al mismo tiempo que ese mismo texto ya apareció en la lista guardada, lo
 * que vuelve ambiguo cualquier `getByText` sobre ese texto hasta que el
 * diálogo termina de cerrarse.
 */
async function esperarCierreDialogo(page: Page) {
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test.describe.serial("MID-25: recorridos end-to-end del PRD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1. Marcelo primera hora: Hoy -> Ficha -> anota + programa -> vuelve y marca hecho", async ({
    page,
  }) => {
    await page.goto("/hoy");

    // Ve el atrasado de Cliente Uno (sembrado por globalSetup) y entra a su ficha.
    const filaAtrasada = page.locator("li", { hasText: NOMBRE_CLIENTE_UNO }).first();
    await expect(filaAtrasada).toBeVisible();
    await filaAtrasada.getByText(NOMBRE_CLIENTE_UNO, { exact: true }).click();
    await page.waitForURL(/\/clientes\/.+\?from=hoy/);
    await expect(page.getByRole("heading", { name: NOMBRE_CLIENTE_UNO })).toBeVisible();

    // Anota una interacción.
    const notaInteraccion = "Llamé y quedamos en retomar contacto la próxima semana.";
    await page.getByRole("button", { name: "Anotar interacción" }).click();
    await page.locator("#canal-interaccion").selectOption("llamada");
    await page.locator("#nota-interaccion").fill(notaInteraccion);
    await page.getByRole("button", { name: "Guardar" }).click();
    await esperarCierreDialogo(page);
    await expect(page.getByText(notaInteraccion)).toBeVisible();

    // Programa el siguiente paso — para mañana, no otro atrasado (si no, el
    // recorrido 4 encontraría un atrasado que esta misma suite creó).
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    await page.getByRole("button", { name: "Programar seguimiento" }).click();
    await page.getByLabel("¿Qué hay que hacer?").fill("Confirmar la decisión");
    await page.getByLabel("Fecha").fill(fechaLocal(manana));
    await page.getByRole("button", { name: "Guardar" }).click();
    await esperarCierreDialogo(page);
    await expect(page.getByText("Confirmar la decisión")).toBeVisible();

    // Vuelve a Hoy y marca como hecho el atrasado ORIGINAL (no el que recién
    // programó, que vence mañana, no hoy) — así no queda ningún atrasado de
    // los propios fixtures para cuando corra el recorrido 4.
    await page.getByRole("button", { name: "Hoy" }).click();
    await page.waitForURL("/hoy");
    // Filtro doble (nombre + texto del atrasado original): a esta altura
    // Cliente Uno ya tiene DOS seguimientos pendientes (el atrasado original
    // y el que se acaba de programar para mañana) — un filtro solo por
    // nombre se volvería ambiguo apenas se marque el primero como hecho.
    const filaAtrasadaOriginal = page
      .locator("li")
      .filter({ hasText: NOMBRE_CLIENTE_UNO })
      .filter({ hasText: "Llamar para retomar el contacto" });
    await filaAtrasadaOriginal.getByRole("button", { name: "Marcar como hecho" }).click();
    await expect(filaAtrasadaOriginal).not.toBeVisible();
  });

  test("2. Marcelo interesado nuevo: Clientes -> + -> Nuevo cliente -> Ficha -> anota", async ({
    page,
  }) => {
    await page.goto("/clientes");

    await page.getByRole("button", { name: "Nuevo cliente" }).first().click();
    await page.getByLabel("Nombre").fill(NOMBRE_CLIENTE_TRES);
    await page.getByLabel("Teléfono").fill("+54 11 5555-0003");
    // Mismo marcador exacto que los fixtures sembrados — así este cliente
    // (creado en vivo, no por sembrarFixtures) también queda dentro del
    // alcance de limpiarTodo() (hallazgo #16 del plan aprobado).
    await page.getByLabel("Nota (opcional)").fill(NOTA_SENTINEL);
    await page.getByRole("button", { name: "Guardar" }).click();

    await page.waitForURL(/\/clientes\/.+\?from=clientes/);
    await expect(page.getByRole("heading", { name: NOMBRE_CLIENTE_TRES })).toBeVisible();

    const primeraInteraccion = "Primer contacto: mandé información del plan básico.";
    await page.getByRole("button", { name: "Anotar interacción" }).click();
    await page.locator("#canal-interaccion").selectOption("whatsapp");
    await page.locator("#nota-interaccion").fill(primeraInteraccion);
    await page.getByRole("button", { name: "Guardar" }).click();
    await esperarCierreDialogo(page);
    await expect(page.getByText(primeraInteraccion)).toBeVisible();
  });

  test("3. Marcelo recibe una llamada de un cliente ya registrado: busca -> Ficha -> ve historial -> anota", async ({
    page,
  }) => {
    await page.goto("/clientes");

    await page.getByPlaceholder("Buscar por nombre, teléfono o email…").fill("Cliente Dos");
    await page.getByText(NOMBRE_CLIENTE_DOS, { exact: true }).click();
    await page.waitForURL(/\/clientes\/.+\?from=clientes/);

    // Ve de qué hablaron la última vez (interacción sembrada por globalSetup).
    await expect(
      page.getByText("Primer contacto: interesado en el plan anual, pidió una propuesta por escrito.")
    ).toBeVisible();

    const nuevaInteraccion = "Llamó para confirmar la fecha de implementación.";
    await page.getByRole("button", { name: "Anotar interacción" }).click();
    await page.locator("#canal-interaccion").selectOption("llamada");
    await page.locator("#nota-interaccion").fill(nuevaInteraccion);
    await page.getByRole("button", { name: "Guardar" }).click();
    await esperarCierreDialogo(page);

    // Las dos interacciones conviven en el historial: la de antes y la recién anotada.
    await expect(page.getByText(nuevaInteraccion)).toBeVisible();
    await expect(
      page.getByText("Primer contacto: interesado en el plan anual, pidió una propuesta por escrito.")
    ).toBeVisible();
  });

  test("4. Emiliana en un rato suelto: sin atrasados propios -> Clientes -> ve una ficha", async ({
    page,
  }) => {
    // Aserción de DATOS primero (hallazgo #11 de la 4ª auditoría): la
    // pantalla Hoy es global, no se puede pedirle que "demuestre" algo sobre
    // datos ajenos — esto confirma, sobre los registros de esta suite nada
    // más, que el recorrido 1 marcó bien su propio atrasado como hecho.
    const hayAtrasados = convexRunJson<boolean>("_scratchTestUser:hayAtrasadosPendientes");
    expect(hayAtrasados).toBe(false);

    // Aserción de UI: lo que efectivamente ve Emiliana — la tarjeta de
    // Cliente Uno ya no aparece bajo "Atrasados" (puntual, no una
    // afirmación de que la sección está vacía en términos absolutos: podría
    // haber atrasados reales/ajenos de pruebas manuales anteriores, y eso no
    // es responsabilidad de esta suite).
    await page.goto("/hoy");
    const seccionAtrasados = page.locator("section", { hasText: "Atrasados" }).first();
    await expect(seccionAtrasados.getByText(NOMBRE_CLIENTE_UNO, { exact: true })).toHaveCount(0);

    await page.goto("/clientes");
    await page.getByPlaceholder("Buscar por nombre, teléfono o email…").fill("Cliente Dos");
    await page.getByText(NOMBRE_CLIENTE_DOS, { exact: true }).click();
    await page.waitForURL(/\/clientes\/.+\?from=clientes/);
    await expect(page.getByRole("heading", { name: NOMBRE_CLIENTE_DOS })).toBeVisible();
  });
});
