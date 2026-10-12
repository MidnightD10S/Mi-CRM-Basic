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
    session.ts        # sesión real (MID-7, Convex Auth) — cambiar contraseña queda en MID-8
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

**MID-7 (autenticación real con Convex Auth) ya está implementado**, pero
solo contra el deployment de **desarrollo** (`formal-dotterel-607`):
- Login real (email + contraseña) en `/login`, sesión persistente entre
  recargas, sin registro público (el provider `Password` bloquea `signUp`).
- Todas las queries/mutations de negocio (`clientes.ts`, `seguimientos.ts`,
  `usuarios.listar`) exigen sesión válida en el **backend**
  (`requireUsuario`, ver `convex/authHelpers.ts`) — no solo en la UI.
  Verificado directamente contra la API HTTP de Convex, sin pasar por
  ninguna pantalla: las llamadas sin sesión se rechazan con "No autenticado.".
- Las dos cuentas (Emiliana/Marcelo) se crean con un bootstrap manual
  (`npx convex run usuarios:asegurarCredenciales`, ver TODO en
  `convex/usuarios.ts`) que nunca imprime contraseñas en un chat ni las deja
  en texto plano una vez confirmada la cuenta.

**Pendiente antes de producción:**
- Las claves de Convex Auth (`JWT_PRIVATE_KEY`/`JWKS`) y el bootstrap de
  credenciales solo existen en desarrollo — hay que repetirlos contra el
  deployment de producción (`zany-starling-504`) antes de que el equipo use
  la app publicada con datos reales.
- "¿Olvidaste tu contraseña?" sigue siendo un placeholder (MID-44) — no hay
  envío de email real todavía.
- Cambiar la contraseña temporal por una propia (MID-8) no está construido.

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
