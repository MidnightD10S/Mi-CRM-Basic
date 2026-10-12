import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Esquema de datos de Vibe CRM.
 * Fuente: PRD de Notion ("CRM - PRD" > sección "Datos") + decisiones registradas
 * en Linear (equipo MID, proyecto "CRM - MVP"):
 *   - usuarios.rol: "propietaria" | "comercial" (MID-6)
 *   - ventas.importe: dólares, se formatea como $1,200.50 en la UI (MID-20/21/23)
 *   - ventas.estado: "oportunidad_abierta" se muestra como "En marcha" (MID-21)
 *
 * TODO(MID-6/MID-7/MID-44): la tabla `usuarios` asume que la autenticación se
 * resuelve con Convex (p.ej. @convex-dev/auth); ajustar los campos de credenciales
 * cuando se decida el mecanismo concreto de login y recuperación de contraseña.
 */
export default defineSchema({
  usuarios: defineTable({
    nombre: v.string(),
    email: v.string(),
    rol: v.union(v.literal("propietaria"), v.literal("comercial")),
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
  }).index("by_cliente", ["clienteId"]),
});
