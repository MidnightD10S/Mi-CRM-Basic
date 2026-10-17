/**
 * MID-25: constantes compartidas por los specs y los hooks globales de esta
 * suite. Deben coincidir EXACTAMENTE con las de `convex/_scratchTestUser.ts`
 * (ad-hoc, nunca se commitea — ver tests/e2e/README.md) — este archivo sí se
 * commitea porque los specs lo importan estáticamente, y ese archivo no.
 */
export const E2E_EMAIL = "e2e-qa@vibe-crm.local";
export const E2E_PASSWORD = "E2eQaFixture2026!";
export const NOMBRE_CLIENTE_UNO = "[E2E] Cliente Uno";
export const NOMBRE_CLIENTE_DOS = "[E2E] Cliente Dos";
export const NOMBRE_CLIENTE_TRES = "[E2E] Cliente Tres";
export const NOTA_SENTINEL = "[E2E-QA-FIXTURE]";
