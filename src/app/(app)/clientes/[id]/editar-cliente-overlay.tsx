"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Overlay } from "@/components/ui/overlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, type Id } from "@/lib/convex-generated";

interface EditarClienteOverlayProps {
  open: boolean;
  onClose: () => void;
  cliente: {
    _id: Id<"clientes">;
    nombre: string;
    telefono?: string;
    email?: string;
    empresa?: string;
  };
}

/**
 * MID-13: edición de los datos de contacto de la Ficha. Mismos campos y
 * reglas que el alta (MID-11) — nombre obligatorio, al menos un medio de
 * contacto — salvo canal de origen y nota, que el issue no lista como
 * editables aquí. El Estado no aparece: se recalcula solo (MID-22).
 *
 * El estado inicial de los campos se toma de `cliente` en el primer render.
 * Para que siempre arranque con los datos vigentes (y no un valor obsoleto de
 * la vez anterior que se abrió), quien use este componente debe remontarlo al
 * abrir (ver `key` en la Ficha) en vez de sincronizar con un efecto.
 */
export function EditarClienteOverlay({ open, onClose, cliente }: EditarClienteOverlayProps) {
  const { show } = useToast();
  const editarCliente = useMutation(api.clientes.editar);

  const [nombre, setNombre] = useState(cliente.nombre);
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [empresa, setEmpresa] = useState(cliente.empresa ?? "");
  const [guardando, setGuardando] = useState(false);

  const tieneContacto = Boolean(telefono.trim() || email.trim());
  const puedeGuardar = Boolean(nombre.trim() && tieneContacto && !guardando);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      await editarCliente({
        id: cliente._id,
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        empresa: empresa.trim() || undefined,
      });
      show("Cliente actualizado");
      onClose();
    } catch {
      show("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const mostrarErrorContacto = !tieneContacto && Boolean(nombre.trim() || telefono || email);
  const contactoErrorId = "contacto-error-editar";

  return (
    <Overlay open={open} onClose={onClose} title="Editar cliente">
      <form className="flex flex-col gap-4" onSubmit={guardar}>
        <Input
          label="Nombre"
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

        <Input label="Empresa (opcional)" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />

        <Button type="submit" disabled={!puedeGuardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </Overlay>
  );
}
