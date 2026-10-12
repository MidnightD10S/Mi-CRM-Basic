/**
 * Reexporta lo generado por Convex (convex/_generated) a través del alias
 * "@/lib/...", para no tener que calcular rutas relativas distintas según la
 * profundidad de cada archivo que necesite `api`/`Id`/`Doc`.
 */
export { api } from "../../convex/_generated/api";
export type { Id, Doc } from "../../convex/_generated/dataModel";
