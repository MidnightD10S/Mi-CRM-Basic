import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Esquema de datos de Vibe CRM.
 * Fuente: PRD de Notion ("CRM - PRD" > sección "Datos") + decisiones registradas
 * en Linear (equipo MID, proyecto "CRM - MVP"):
 *   - usuarios.rol: "propietaria" | "comercial" (MID-6)
 *   - ventas.importe: dólares, se formatea como $1,200.50 en la UI (MID-20/21/23)
 *   - ventas.estado: "oportunidad_abierta" se muestra como "En marcha" (MID-21)
 *
 * MID-7: autenticación resuelta con @convex-dev/auth (provider Password,
 * ver convex/auth.ts) — `authTables` trae sus propias tablas (`users`,
 * `authAccounts`, `authVerificationCodes`, etc.), separadas de `usuarios`.
 * MID-44: recuperación de contraseña real (código por email, vía
 * `authVerificationCodes` y el `reset` de `convex/auth.ts`).
 */
export default defineSchema({
  ...authTables,

  usuarios: defineTable({
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
    // Bootstrap de credenciales (MID-7, ver convex/usuarios.ts): opcional,
    // sin tocar nada existente. El estado "creada" NO tiene campo `password`
    // — no se conserva texto plano una vez verificada la cuenta.
    credencial: v.optional(
      v.union(
        v.object({
          estado: v.literal("creando"),
          reclamadoEn: v.number(),
          token: v.string(),
          password: v.string(),
        }),
        v.object({ estado: v.literal("creada") })
      )
    ),
  }).index("by_email", ["email"]),

  clientes: defineTable({
    nombre: v.string(),
    empresa: v.optional(v.string()),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    canalOrigen: v.optional(
      v.union(v.literal("web"), v.literal("redes"), v.literal("email"), v.literal("whatsapp"))
    ),
    // Opcional a propósito: así un documento preexistente sin este campo sigue
    // siendo válido contra el esquema. La UI trata su ausencia como "nuevo_lead"
    // (ver src/lib/constants.ts).
    estado: v.optional(
      v.union(
        v.literal("nuevo_lead"),
        v.literal("en_negociacion"),
        v.literal("ganado"),
        v.literal("perdido")
      )
    ),
    nota: v.optional(v.string()),
    creadoEn: v.number(),
  }).searchIndex("search_nombre", { searchField: "nombre" }),

  interacciones: defineTable({
    clienteId: v.id("clientes"),
    tipo: v.union(
      v.literal("llamada"),
      v.literal("email"),
      v.literal("whatsapp"),
      v.literal("en_persona")
    ),
    nota: v.string(),
    fecha: v.number(),
    autorId: v.id("usuarios"),
  }).index("by_cliente", ["clienteId"]),

  seguimientos: defineTable({
    clienteId: v.id("clientes"),
    accion: v.string(),
    vence: v.number(),
    hecho: v.boolean(),
    fechaHecho: v.optional(v.number()),
    responsableId: v.id("usuarios"),
  })
    .index("by_cliente", ["clienteId"])
    .index("by_hecho_vence", ["hecho", "vence"]),

  ventas: defineTable({
    clienteId: v.id("clientes"),
    concepto: v.string(),
    importe: v.number(),
    estado: v.union(
      v.literal("oportunidad_abierta"),
      v.literal("ganada"),
      v.literal("perdida")
    ),
    fecha: v.number(),
    autorId: v.id("usuarios"),
    // MID-23: opcional por el mismo motivo que `clientes.estado` — un documento
    // preexistente sin este campo sigue siendo válido, su ausencia se trata como
    // "todavía no contado" en `resumenVentas` (ver convex/ventas.ts).
    contadoEnResumen: v.optional(v.boolean()),
  })
    .index("by_cliente", ["clienteId"])
    // MID-22: existencia indexada por estado (sin recorrer el historial completo
    // del cliente) para recalcular el Estado del cliente en cada alta.
    .index("by_cliente_estado", ["clienteId", "estado"])
    // MID-21: `fecha` la elige la persona usuaria (no es Date.now() al crear, a
    // diferencia de `interacciones.fecha`), así que el historial por cliente
    // necesita ordenar por este campo vía índice, no por `_creationTime`.
    .index("by_cliente_fecha", ["clienteId", "fecha"])
    // MID-23: índice global (no compuesto por cliente) para la pantalla
    // agregada "Ventas y oportunidades" — ordenar/acotar el listado cruzado
    // de clientes vía índice, sin un `.collect()` de toda la tabla.
    .index("by_fecha", ["fecha"]),

  // MID-23: documento único (como mucho una fila) con el resumen acumulado de
  // todas las ventas del negocio, mantenido de forma incremental por
  // `incrementarResumen` (ver convex/ventas.ts) — así la query `resumen` es
  // una lectura O(1), no un escaneo de `ventas` en cada apertura de pantalla.
  // Sumas en centavos enteros (no dólares de punto flotante), mismo criterio
  // que `normalizarImporte`.
  resumenVentas: defineTable({
    enMarchaCentavos: v.number(),
    enMarchaCantidad: v.number(),
    ganadaCentavos: v.number(),
    ganadaCantidad: v.number(),
    perdidaCentavos: v.number(),
    perdidaCantidad: v.number(),
  }),
});
