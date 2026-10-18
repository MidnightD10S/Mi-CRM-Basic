import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * MID-25: constantes compartidas por los specs y los hooks globales de esta
 * suite. `E2E_EMAIL`/los nombres/`NOTA_SENTINEL` deben coincidir EXACTAMENTE
 * con los de `convex/_scratchTestUser.ts` (ad-hoc, nunca se commitea — ver
 * tests/e2e/README.md, que trae su contenido exacto para recrearlo).
 */
export const E2E_EMAIL = "e2e-qa@vibe-crm.local";
export const NOMBRE_CLIENTE_UNO = "[E2E] Cliente Uno";
export const NOMBRE_CLIENTE_DOS = "[E2E] Cliente Dos";
export const NOMBRE_CLIENTE_TRES = "[E2E] Cliente Tres";
export const NOTA_SENTINEL = "[E2E-QA-FIXTURE]";

// La contraseña NUNCA vive en código versionado (hallazgo de auditoría: una
// credencial fija en el repo deja autenticarse como este usuario a
// cualquiera con acceso al repo, contra un backend que sí permite consultar
// datos de negocio a cualquier usuario autenticado). `crearCuentaYFixtures`
// genera una contraseña aleatoria en cada corrida y `globalSetup` la escribe
// acá — un archivo local, gitignored, que `globalTeardown` borra al
// terminar. Los specs la leen en tiempo de ejecución, nunca como constante.
export const E2E_CREDENTIALS_PATH = path.join(__dirname, ".e2e-credentials.local.json");

export function leerPasswordE2E(): string {
  const contenido = JSON.parse(readFileSync(E2E_CREDENTIALS_PATH, "utf-8")) as { password: string };
  return contenido.password;
}
