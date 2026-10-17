import { defineConfig } from "playwright/test";

/**
 * MID-25: QA end-to-end de los 4 recorridos del PRD. Suite puntual contra
 * el deployment de desarrollo local, no una suite de CI — por eso
 * `fullyParallel: false` + `workers: 1`: los specs comparten el mismo
 * usuario/dataset de prueba y dependen entre sí en un orden fijo (ver
 * tests/e2e/recorridos.spec.ts), así que no pueden correr en paralelo.
 *
 * `globalSetup`/`globalTeardown` (tests/e2e/global-setup.ts y
 * global-teardown.ts) manejan el ciclo de vida del usuario/fixtures de
 * prueba contra Convex — ver convex/_scratchTestUser.ts (ad-hoc, nunca se
 * commitea).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
});
