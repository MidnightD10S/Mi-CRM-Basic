"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
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

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <AsegurarSeedUsuarios />
      {children}
    </ConvexProvider>
  );
}
