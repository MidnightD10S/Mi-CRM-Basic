import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUsuario } from "./authHelpers";

/**
 * MID-7: todas las queries/mutations exigen sesión real (`requireUsuario`,
 * ver convex/authHelpers.ts) — la protección vive en el backend, no solo en
 * el guard de rutas de la UI.
 */

// Límite explícito: MVP de negocio pequeño (decenas de clientes, no miles).
// Si el volumen creciera, paginar sería un cambio aparte.
const LIMITE_BUSQUEDA = 20;

// Chequeo simple de forma (no RFC 5322 completo) — suficiente para detectar
// que alguien escribió un email mal formado, sin rechazar direcciones válidas
// pero inusuales.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(email: string | undefined): void {
  if (email && !EMAIL_REGEX.test(email)) {
    throw new Error("El email no tiene un formato válido.");
  }
}

export const buscar = query({
  args: { texto: v.string() },
  handler: async (ctx, { texto }) => {
    await requireUsuario(ctx);
    const resultados =
      texto.trim() === ""
        ? await ctx.db.query("clientes").order("desc").take(LIMITE_BUSQUEDA)
        : await ctx.db
            .query("clientes")
            .withSearchIndex("search_nombre", (q) => q.search("nombre", texto))
            .take(LIMITE_BUSQUEDA);
    // Recorte de campos (hallazgo de auditoría): el selector de "Nueva tarea"
    // (único llamador) solo usa `_id`/`nombre` — no hay motivo para devolver
    // teléfono, email o nota de cada cliente a una query pública sin auth.
    return resultados.map((cliente) => ({ _id: cliente._id, nombre: cliente.nombre }));
  },
});

export const crearMinimo = mutation({
  args: {
    nombre: v.string(),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { nombre, telefono, email }) => {
    await requireUsuario(ctx);
    // El tipo `v.string()` no impide una cadena vacía o solo espacios, así
    // que la invariante de "no vacío" se valida aquí, no solo en la UI.
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      throw new Error("El nombre del cliente no puede estar vacío.");
    }
    const telefonoLimpio = telefono?.trim();
    const emailLimpio = email?.trim();
    validarEmail(emailLimpio);
    return await ctx.db.insert("clientes", {
      nombre: nombreLimpio,
      telefono: telefonoLimpio || undefined,
      email: emailLimpio || undefined,
      estado: "nuevo_lead",
      creadoEn: Date.now(),
    });
  },
});

/**
 * Alta completa (MID-11): además del alta mínima de arriba, admite empresa,
 * canal de origen y nota, y exige al menos un medio de contacto (teléfono o
 * email) — regla central del issue, validada aquí porque no puede depender
 * solo de que la UI la respete.
 */
export const crear = mutation({
  args: {
    nombre: v.string(),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    empresa: v.optional(v.string()),
    canalOrigen: v.optional(
      v.union(v.literal("web"), v.literal("redes"), v.literal("email"), v.literal("whatsapp"))
    ),
    nota: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUsuario(ctx);
    const nombreLimpio = args.nombre.trim();
    if (!nombreLimpio) {
      throw new Error("El nombre del cliente no puede estar vacío.");
    }
    const telefonoLimpio = args.telefono?.trim();
    const emailLimpio = args.email?.trim();
    if (!telefonoLimpio && !emailLimpio) {
      throw new Error("Agrega un teléfono o un email.");
    }
    validarEmail(emailLimpio);
    const empresaLimpia = args.empresa?.trim();
    const notaLimpia = args.nota?.trim();
    return await ctx.db.insert("clientes", {
      nombre: nombreLimpio,
      telefono: telefonoLimpio || undefined,
      email: emailLimpio || undefined,
      empresa: empresaLimpia || undefined,
      canalOrigen: args.canalOrigen,
      nota: notaLimpia || undefined,
      estado: "nuevo_lead",
      creadoEn: Date.now(),
    });
  },
});

// Mismo criterio de límite explícito que el resto del archivo: MVP de negocio
// pequeño (decenas de clientes, no miles). "Lista completa" en `listar`
// significa "completa dentro de este límite", no una garantía ilimitada.
const LIMITE_LISTADO = 500;

function soloDigitos(valor: string): string {
  return valor.replace(/[^0-9]/g, "");
}

/**
 * Lista con buscador de MID-12 — distinta de `buscar` (arriba), que solo
 * busca por nombre vía índice de búsqueda y se usa en el selector de "Nueva
 * tarea". Esta filtra en memoria por nombre, email y teléfono (el teléfono
 * ignora espacios/símbolos, comparando solo dígitos) sobre los `LIMITE_LISTADO`
 * clientes más recientes — alcance acotado a propósito al tamaño del negocio,
 * sin añadir más índices de búsqueda.
 */
export const listar = query({
  args: { texto: v.string() },
  handler: async (ctx, { texto }) => {
    await requireUsuario(ctx);
    const todos = await ctx.db.query("clientes").order("desc").take(LIMITE_LISTADO);
    const textoLimpio = texto.trim().toLowerCase();
    const textoDigitos = soloDigitos(texto);

    const coincidentes = !textoLimpio
      ? todos
      : todos.filter((cliente) => {
          const nombreCoincide = cliente.nombre.toLowerCase().includes(textoLimpio);
          const emailCoincide = cliente.email?.toLowerCase().includes(textoLimpio) ?? false;
          // Guarda crítica: sin dígitos en el texto buscado, NO se compara por
          // teléfono. `"".includes("")` es `true`, así que sin esta guarda
          // cualquier búsqueda por nombre/email (sin dígitos) "coincidiría"
          // también con todo cliente que tuviera teléfono, rompiendo el filtro.
          const telefonoCoincide =
            textoDigitos.length > 0 &&
            Boolean(cliente.telefono && soloDigitos(cliente.telefono).includes(textoDigitos));
          return nombreCoincide || emailCoincide || telefonoCoincide;
        });

    // Recorte de campos: el filtro necesita telefono/email del documento
    // completo, pero no hay motivo para exponerlos a cualquier llamador de
    // esta query pública (sin auth todavía) — la lista solo necesita nombre,
    // estado y fecha de alta. Mismo criterio ya aplicado en usuarios.ts.
    return coincidentes.map((cliente) => ({
      _id: cliente._id,
      nombre: cliente.nombre,
      estado: cliente.estado,
      creadoEn: cliente.creadoEn,
    }));
  },
});

/**
 * Ficha de cliente (MID-13): a diferencia de `buscar`/`listar`, aquí sí se
 * necesitan todos los campos (incluye nota, usada en la ficha) — es una
 * lectura de un cliente puntual, no un listado masivo.
 */
export const obtener = query({
  args: { id: v.id("clientes") },
  handler: async (ctx, { id }) => {
    await requireUsuario(ctx);
    return await ctx.db.get(id);
  },
});

/**
 * Edición de la Ficha de cliente (MID-13): mismos campos y mismas reglas de
 * validación que `crear` (nombre no vacío, al menos un medio de contacto,
 * formato de email) — una persona no puede llegar a un estado inválido
 * editando que no podría alcanzar creando. `estado` no es parte de los args:
 * no se edita aquí, se recalcula solo a partir de las ventas (MID-22).
 */
export const editar = mutation({
  args: {
    id: v.id("clientes"),
    nombre: v.string(),
    telefono: v.optional(v.string()),
    email: v.optional(v.string()),
    empresa: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUsuario(ctx);
    const existente = await ctx.db.get(args.id);
    if (!existente) {
      throw new Error("El cliente no existe.");
    }
    const nombreLimpio = args.nombre.trim();
    if (!nombreLimpio) {
      throw new Error("El nombre del cliente no puede estar vacío.");
    }
    const telefonoLimpio = args.telefono?.trim();
    const emailLimpio = args.email?.trim();
    if (!telefonoLimpio && !emailLimpio) {
      throw new Error("Agrega un teléfono o un email.");
    }
    validarEmail(emailLimpio);
    const empresaLimpia = args.empresa?.trim();
    await ctx.db.patch(args.id, {
      nombre: nombreLimpio,
      telefono: telefonoLimpio || undefined,
      email: emailLimpio || undefined,
      empresa: empresaLimpia || undefined,
    });
  },
});
