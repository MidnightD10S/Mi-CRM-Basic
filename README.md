# Vibe CRM

CRM simple para un negocio pequeño de ventas digitales: organiza clientes y evita
perder ventas por falta de seguimiento. Next.js (App Router) + Convex, pensado
para publicarse en Railway.

Gestión del producto:
- **PRD / MVP**: Notion, página "CRM - PRD" (no se modifica directamente; las
  novedades se registran en "CRM, cambios y mejoras").
- **Tareas**: Linear, equipo `MID`, proyectos "CRM - MVP" y "CRM - Post-MVP".
- **Diseño**: carpeta `design/` (prototipo navegable + `design.md` con los tokens
  y specs de componentes — es la fuente de verdad visual).

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack).
- **Tailwind CSS v4**, tokens del design system portados a `src/app/globals.css`
  (colores, tipografía, espaciado, sombras — ver `design/design.md`).
- **Convex** como base de datos y backend (`convex/schema.ts`).
- **lucide-react** para iconos, **Inter** + **JetBrains Mono** (next/font) para
  tipografía.

## Estructura

```
src/
  app/
    (auth)/           # login, recuperar/restablecer contraseña — sin barra de navegación
    (app)/            # hoy, clientes, clientes/[id], ventas, equipo, cuenta — con shell
  components/
    ui/               # primitivos del design system: Button, Card, Badge, Avatar, Input, EmptyState
    layout/           # Sidebar, TabBar, nav-items, PantallaPendiente
    providers/        # ConvexClientProvider
  lib/
    constants.ts      # enums del dominio (roles, estados, canales) y sus etiquetas
    format.ts         # formato de moneda y fechas relativas
    session.ts        # placeholder de sesión — sustituir al implementar login (MID-6/7/10/44)
    utils.ts          # cn() (clsx + tailwind-merge)
convex/
  schema.ts           # tablas: usuarios, clientes, interacciones, seguimientos, ventas
```

"Hoy" (MID-18) y el shell de navegación (MID-10) ya están construidos. Cada
pantalla todavía sin construir muestra un placeholder (`PantallaPendiente`)
con el id del issue de Linear que la implementa, para no perder la referencia.

## Primeros pasos

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar las variables de entorno:
   ```bash
   cp .env.local.example .env.local
   ```
3. Iniciar Convex (abre el navegador para loguearte y crear/vincular el proyecto
   la primera vez; a partir de ahí rellena `NEXT_PUBLIC_CONVEX_URL` solo):
   ```bash
   npx convex dev
   ```
4. En otra terminal, iniciar Next.js:
   ```bash
   npm run dev
   ```
   O ambos a la vez con `npm run dev:all`.
5. Abrir [http://localhost:3000](http://localhost:3000) (redirige a `/hoy`).

## Decisiones ya fijadas (no reabrir sin revisar Linear/Notion)

- **Moneda**: dólares, formato `$1,200.50` (el prototipo HTML de diseño muestra
  euros; es una inconsistencia visual del archivo, no la referencia a seguir —
  ver issues MID-20/21/23 y la entrada del 2026-10-12 en "CRM, cambios y mejoras").
- **Roles**: enum interno `propietaria` / `comercial`, etiquetas "Dueña" /
  "Atiende y vende" (MID-6).
- **Recuperar contraseña**: entra como flujo real en el MVP, no como enlace sin
  función (MID-44).

## Estado de seguridad (leer antes de publicar)

**Todavía no existe autenticación ni autorización real (MID-7).** Todas las
funciones de Convex son públicas: cualquiera con la URL del deployment puede
leer o escribir clientes/seguimientos/usuarios sin iniciar sesión. Esto es
aceptable mientras el deployment de Convex en uso sea el de **desarrollo**,
sin datos reales del negocio. Antes de dar por buena una publicación real en
Railway (es decir, que el equipo la use con datos de clientes reales), hay que
implementar MID-7, o al menos decidir y documentar explícitamente que se
acepta ese riesgo por un tiempo acotado.

Railway está conectado a este repositorio para publicación automática: un
`git push` a la rama por defecto dispara un deploy. Tenlo en cuenta antes de
subir cambios — un push no es solo "guardar en GitHub", es "publicar".

## Despliegue

- **GitHub**: este repo se sube tal cual; `node_modules`, `.next` y `.env*`
  (salvo `*.example`) están ignorados.
- **Railway**: usa `railway.toml` (Nixpacks, `npm run build` / `npm run start`).
  Configurar en Railway la variable `NEXT_PUBLIC_CONVEX_URL` con la URL del
  deployment de **producción** de Convex (`npx convex deploy`), no la de
  desarrollo.
