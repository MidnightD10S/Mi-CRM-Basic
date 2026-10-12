/**
 * Enums y etiquetas del dominio Vibe CRM.
 * Fuente: PRD de Notion ("CRM - PRD") + decisiones registradas en los issues de Linear
 * (MID-6, MID-20, MID-21). Los valores de enum no se traducen; solo sus etiquetas.
 */

export const ROLES = {
  propietaria: "Dueña",
  comercial: "Atiende y vende",
} as const;

export type Rol = keyof typeof ROLES;

export const ESTADOS_CLIENTE = {
  nuevo_lead: { label: "Nuevo lead", tone: "info" },
  en_negociacion: { label: "En negociación", tone: "primary" },
  ganado: { label: "Ganado", tone: "success" },
  perdido: { label: "Perdido", tone: "error" },
} as const;

export type EstadoCliente = keyof typeof ESTADOS_CLIENTE;

/**
 * `clientes.estado` es opcional en el esquema (ver convex/schema.ts) para no
 * depender de que el deployment esté vacío al añadir el campo. Cualquier
 * cliente sin estado se trata como "nuevo_lead" — fallback explícito, no un
 * valor inventado en cada pantalla.
 */
export function estadoClienteOFallback(estado: EstadoCliente | undefined): EstadoCliente {
  return estado ?? "nuevo_lead";
}

export const CANALES_ORIGEN = {
  web: "Web",
  redes: "Redes sociales",
  email: "Email",
  whatsapp: "WhatsApp",
} as const;

export type CanalOrigen = keyof typeof CANALES_ORIGEN;

export const CANALES_INTERACCION = {
  llamada: "Llamada",
  email: "Email",
  whatsapp: "WhatsApp",
  en_persona: "En persona",
} as const;

export type CanalInteraccion = keyof typeof CANALES_INTERACCION;

/**
 * Moneda: dólares, formato $1,200.50 (ver issues MID-20/21/23 — el prototipo de
 * diseño muestra euros, es una inconsistencia visual, no la referencia a seguir).
 */
export const ESTADOS_VENTA = {
  oportunidad_abierta: { label: "En marcha", tone: "info" },
  ganada: { label: "Ganada", tone: "success" },
  perdida: { label: "Perdida", tone: "error" },
} as const;

export type EstadoVenta = keyof typeof ESTADOS_VENTA;
