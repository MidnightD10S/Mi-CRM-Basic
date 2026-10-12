"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useEffect, type ReactNode } from "react";
import { api } from "@/lib/convex-generated";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL no está definida. Copia .env.local.example a .env.local " +
      "y ejecuta `npx convex dev` para generarla."
  );
}

const convex = new ConvexReactClient(convexUrl ?? "https://placeholder.convex.cloud");

/**
 * Dispara el seed de usuarios (ver convex/usuarios.ts) una vez al montar la
 * app. Es idempotente por email, así que es seguro llamarlo en cada carga —
 * evita el paso manual de correr `npx convex run usuarios:asegurarSeed`.
 */
function AsegurarSeedUsuarios() {
  useEffect(() => {
    convex.mutation(api.usuarios.asegurarSeed, {}).catch((error) => {
      console.error("No se pudo asegurar el seed de usuarios:", error);
    });
  }, []);
  return null;
}

/**
 * MID-7: `ConvexAuthProvider` (de @convex-dev/auth/react) reemplaza al
 * `ConvexProvider` plano — gestiona la persistencia de la sesión entre
 * recargas/cierres del navegador (almacenamiento del lado del cliente, sin
 * requerir SSR, ya que toda la app es "use client").
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <AsegurarSeedUsuarios />
      {children}
    </ConvexAuthProvider>
  );
}
