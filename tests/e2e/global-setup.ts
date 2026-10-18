import { writeFileSync } from "node:fs";
import { convexRun, convexRunJson } from "./convex-cli";
import { E2E_CREDENTIALS_PATH } from "./fixtures";

/**
 * MID-25: barrida de limpieza de "red de seguridad" (por si una corrida
 * anterior quedó interrumpida antes de llegar a su `globalTeardown`) y
 * recién después siembra la cuenta + los fixtures frescos. Ver
 * convex/_scratchTestUser.ts (ad-hoc, no commiteado — tests/e2e/README.md).
 *
 * La contraseña que genera `crearCuentaYFixtures` (aleatoria en cada
 * corrida, nunca fija) se escribe acá en un archivo local gitignored — los
 * specs la leen de ahí en tiempo de ejecución (`leerPasswordE2E`), nunca
 * como constante versionada.
 */
export default async function globalSetup() {
  convexRun("_scratchTestUser:limpiarTodo");
  const { password } = convexRunJson<{ email: string; password: string }>(
    "_scratchTestUser:crearCuentaYFixtures"
  );
  writeFileSync(E2E_CREDENTIALS_PATH, JSON.stringify({ password }), "utf-8");
}
