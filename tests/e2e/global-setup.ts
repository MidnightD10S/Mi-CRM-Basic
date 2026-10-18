import { rmSync, writeFileSync } from "node:fs";
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
 *
 * Hallazgo de auditoría: si una corrida anterior murió entre escribir ese
 * archivo y que su propio `globalTeardown` lo borrara, una contraseña vieja
 * (de una cuenta que `limpiarTodo` ya va a borrar de abajo) podía quedar
 * tirada en disco. Se borra PRIMERO, antes de llamar a Convex siquiera, para
 * no depender de que la limpieza de la cuenta en sí haya salido bien.
 */
export default async function globalSetup() {
  rmSync(E2E_CREDENTIALS_PATH, { force: true });
  convexRun("_scratchTestUser:limpiarTodo");
  const { password } = convexRunJson<{ email: string; password: string }>(
    "_scratchTestUser:crearCuentaYFixtures"
  );
  writeFileSync(E2E_CREDENTIALS_PATH, JSON.stringify({ password }), "utf-8");
}
