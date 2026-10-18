import { execSync, type ExecSyncOptionsWithStringEncoding } from "node:child_process";

// `execSync` ya corre siempre a través de una shell (a diferencia de
// `spawn`), así que no hace falta pasar `shell` explícito. `functionName`
// siempre es un literal fijo pasado desde este mismo repo (nunca
// interpolación de datos externos), así que no hay riesgo de inyección.
const opciones: ExecSyncOptionsWithStringEncoding = {
  encoding: "utf-8",
};

/**
 * Invoca una función de `convex/_scratchTestUser.ts` (internal, ad-hoc —
 * ver README.md de esta carpeta) vía el CLI de Convex, que tiene acceso de
 * administrador al deployment y puede llamar funciones `internal`
 * directamente, sin exponer nada público nuevo.
 */
export function convexRun(functionName: string): void {
  const salida = execSync(`npx convex run ${functionName}`, opciones);
  process.stdout.write(salida);
}

/**
 * Igual que `convexRun`, pero parsea la salida como JSON en vez de solo
 * volcarla — para leer el resultado de una query interna de prueba
 * (recorrido 4: "sin atrasados", ver recorridos.spec.ts) en vez de solo
 * dispararla.
 */
export function convexRunJson<T>(functionName: string): T {
  const salida = execSync(`npx convex run ${functionName}`, opciones);
  return JSON.parse(salida.trim()) as T;
}
