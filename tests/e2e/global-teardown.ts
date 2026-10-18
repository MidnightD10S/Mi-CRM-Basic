import { rmSync } from "node:fs";
import { convexRun } from "./convex-cli";
import { E2E_CREDENTIALS_PATH } from "./fixtures";

/**
 * MID-25: limpieza final — ver global-setup.ts y tests/e2e/README.md.
 *
 * `finally` (hallazgo de auditoría): si `limpiarTodo` fallara (red, CLI,
 * etc.), el archivo con la contraseña no debe sobrevivir en disco solo
 * porque la limpieza de la cuenta en Convex no salió bien — son dos
 * problemas distintos, y dejar la contraseña tirada agrava el primero. El
 * error de `convexRun` igual se propaga (sin `try`/`catch` que lo trague),
 * así que Playwright sigue reportando el fallo real.
 */
export default async function globalTeardown() {
  try {
    convexRun("_scratchTestUser:limpiarTodo");
  } finally {
    rmSync(E2E_CREDENTIALS_PATH, { force: true });
  }
}
