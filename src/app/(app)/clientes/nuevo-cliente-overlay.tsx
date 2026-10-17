"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CANALES_ORIGEN, type CanalOrigen } from "@/lib/constants";
import { api } from "@/lib/convex-generated";

interface NuevoClienteOverlayProps {
  open: boolean;
  onClose: () => void;
  // MID-24: de dónde se abrió el overlay — este componente se usa tanto
  // desde Clientes como desde el acceso rápido de Hoy (ver sus llamadores),
  // y la Ficha a la que navega al guardar necesita saber el origen real
  // para que su botón "atrás" vuelva al lugar correcto.
  origen?: "clientes" | "hoy";
}

const selectClass =
  "h-12 rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 text-[15px] text-(--color-text) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]";

const textareaClass =
  "min-h-20 resize-none rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) px-3.5 py-2.5 text-[15px] text-(--color-text) placeholder:text-(--color-text-subtle) focus:border-(--color-primary) focus-visible:shadow-[var(--focus-ring)]";

/**
 * MID-11: alta completa de cliente, distinta del alta mínima inline que usa
 * el selector de "Nueva tarea" en Hoy (`clientes.crearMinimo`). Al guardar,
 * crea el cliente con Estado inicial "Nuevo lead" (lo asigna el servidor) y
 * navega a su Ficha.
 */
export function NuevoClienteOverlay({ open, onClose, origen = "clientes" }: NuevoClienteOverlayProps) {
  const router = useRouter();
  const { show } = useToast();
  const crearCliente = useMutation(api.clientes.crear);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [canalOrigen, setCanalOrigen] = useState<CanalOrigen | "">("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  function reiniciar() {
    setNombre("");
    setTelefono("");
    setEmail("");
    setEmpresa("");
    setCanalOrigen("");
    setNota("");
  }

  function cerrar() {
    reiniciar();
    onClose();
  }

  const tieneContacto = Boolean(telefono.trim() || email.trim());
  const puedeGuardar = Boolean(nombre.trim() && tieneContacto && !guardando);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeGuardar || guardando) return;
    setGuardando(true);
    try {
      const id = await crearCliente({
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        empresa: empresa.trim() || undefined,
        canalOrigen: canalOrigen || undefined,
        nota: nota.trim() || undefined,
      });
      show("Cliente añadido");
      cerrar();
      router.push(`/clientes/${id}?from=${origen}`, { transitionTypes: ["nav-forward"] });
    } catch {
      show("No se pudo crear el cliente. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const mostrarErrorContacto = !tieneContacto && Boolean(nombre.trim() || telefono || email);
  const contactoErrorId = "contacto-error";

  return (
    <Overlay open={open} onClose={cerrar} title="Nuevo cliente">
      <form className="flex flex-col gap-4" onSubmit={guardar}>
        <Input
          label="Nombre"
          placeholder="Nombre del cliente"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Teléfono"
              placeholder="Opcional si hay email"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              aria-describedby={mostrarErrorContacto ? contactoErrorId : undefined}
            />
            <Input
              label="Email"
              type="email"
              placeholder="Opcional si hay teléfono"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={mostrarErrorContacto ? contactoErrorId : undefined}
            />
          </div>
          {mostrarErrorContacto && (
            <p id={contactoErrorId} role="alert" className="text-[13px] text-(--color-error-text)">
              Agrega un teléfono o un email.
            </p>
          )}
        </div>

        <Input
          label="Empresa (opcional)"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="canal-origen" className="text-sm font-medium text-(--color-text)">
            Canal de origen (opcional)
          </label>
          <select
            id="canal-origen"
            className={selectClass}
            value={canalOrigen}
            onChange={(e) => setCanalOrigen(e.target.value as CanalOrigen | "")}
          >
            <option value="">Sin especificar</option>
            {Object.entries(CANALES_ORIGEN).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota-cliente" className="text-sm font-medium text-(--color-text)">
            Nota (opcional)
          </label>
          <textarea
            id="nota-cliente"
            className={textareaClass}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={!puedeGuardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </Overlay>
  );
}
