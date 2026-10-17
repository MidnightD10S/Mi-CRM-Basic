import { convexRun } from "./convex-cli";

/**
 * MID-25: barrida de limpieza de "red de seguridad" (por si una corrida
 * anterior quedó interrumpida antes de llegar a su `globalTeardown`) y
 * recién después siembra la cuenta + los fixtures frescos. Ver
 * convex/_scratchTestUser.ts (ad-hoc, no commiteado — tests/e2e/README.md).
 */
export default async function globalSetup() {
  convexRun("_scratchTestUser:limpiarTodo");
  convexRun("_scratchTestUser:crearCuentaYFixtures");
}
