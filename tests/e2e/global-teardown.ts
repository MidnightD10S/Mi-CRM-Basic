import { rmSync } from "node:fs";
import { convexRun } from "./convex-cli";
import { E2E_CREDENTIALS_PATH } from "./fixtures";

/** MID-25: limpieza final — ver global-setup.ts y tests/e2e/README.md. */
export default async function globalTeardown() {
  convexRun("_scratchTestUser:limpiarTodo");
  rmSync(E2E_CREDENTIALS_PATH, { force: true });
}
