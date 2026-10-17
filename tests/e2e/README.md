# MID-25 — Suite end-to-end

Automatiza los 4 recorridos del PRD (`tests/e2e/recorridos.spec.ts`) contra
`http://localhost:3100` (`next dev`) y el deployment de desarrollo de Convex
(`npx convex dev`), que deben estar corriendo antes de ejecutar la suite.

## Requisito: `convex/_scratchTestUser.ts`

Esta suite necesita que exista `convex/_scratchTestUser.ts` en el
deployment de desarrollo — un archivo **ad-hoc que nunca se commitea**
(mismo criterio que los scripts de credenciales de MID-7), porque son
funciones `internal` con permiso de borrado amplio (gated por
`assertDevDeployment()`, que aborta fuera del deployment de desarrollo
esperado) y no tiene sentido que queden desplegadas permanentemente en el
código del negocio.

Si el archivo no existe, recrearlo con tres funciones — `assertDevDeployment`
(comparación exacta de `CONVEX_SITE_URL`, no por subcadena),
`sembrarFixtures`/`crearCuentaYFixtures` (fila en `usuarios` + dos clientes
marcados, uno con un seguimiento vencido y otro con una interacción previa)
y `limpiarTodo` (borra todo lo marcado, sin argumentos — descubre por el
email fijo de la cuenta y por igualdad exacta de `nota`). Los valores deben
coincidir con `tests/e2e/fixtures.ts`:

- Email de la cuenta: `E2E_EMAIL` (`tests/e2e/fixtures.ts`)
- Contraseña: `E2E_PASSWORD`
- Marcador de borrado en `clientes.nota`: `NOTA_SENTINEL`
  (**criterio exacto de borrado** — nunca un prefijo de `nombre`, que solo
  sirve para reconocer los fixtures a simple vista en la UI)

Ver el plan de MID-24/MID-25 (`.claude/plans/` o el historial de esta
conversación) para el diseño completo y los hallazgos de auditoría que lo
motivan.

## Correr la suite

```
npm run test:e2e
```

`globalSetup` corre una barrida de limpieza (red de seguridad, por si una
corrida anterior quedó interrumpida) y siembra la cuenta + los fixtures.
`globalTeardown` corre la misma limpieza al final. Los 4 recorridos corren
en serie (`workers: 1`, `test.describe.serial`), en un único spec, porque
comparten datos y dependen entre sí en el orden fijo del PRD.
