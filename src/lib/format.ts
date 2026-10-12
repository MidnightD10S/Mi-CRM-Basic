/**
 * Formato de importes: dólares, $1,200.50 (símbolo delante, coma de miles, dos
 * decimales). Decisión confirmada en los issues MID-20/21/23 de Linear.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Etiqueta de "último contacto" / fecha relativa pasada, según el diseño
 * (issue MID-12): "Hoy" / "Ayer" / "Hace N días" (<7) / "Hace N semanas" (>=7).
 */
export function formatRelativePast(date: Date, now: Date = new Date()): string {
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);

  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;

  const weeks = Math.floor(days / 7);
  return `Hace ${weeks} semana${weeks === 1 ? "" : "s"}`;
}

/**
 * Etiqueta de fecha de un seguimiento en Tareas del día (issue MID-18):
 * "Venció ayer" / "Venció hace N días" (atrasado) o "Vence hoy" / "Vence el [fecha]" (próximo).
 */
export function formatSeguimientoDueLabel(date: Date, now: Date = new Date()): string {
  const days = Math.floor((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);

  if (days === 0) return "Vence hoy";
  if (days > 0) return `Vence el ${date.toLocaleDateString("es-ES")}`;
  if (days === -1) return "Venció ayer";
  return `Venció hace ${Math.abs(days)} días`;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
