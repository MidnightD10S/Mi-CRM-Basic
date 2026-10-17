import { convexRun } from "./convex-cli";

/** MID-25: limpieza final — ver global-setup.ts y tests/e2e/README.md. */
export default async function globalTeardown() {
  convexRun("_scratchTestUser:limpiarTodo");
}
