"use client";

import { useState, ViewTransition } from "react";
import { useQuery } from "convex/react";
import { Plus, UserCog, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useSessionUsuario } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import { api } from "@/lib/convex-generated";
import { PersonaOverlay, type PersonaEnEdicion } from "./persona-overlay";
import { EliminarPersonaOverlay } from "./eliminar-persona-overlay";

/** MID-9: pantalla de gestión del equipo — solo accesible para la Dueña. */
export default function EquipoPage() {
  const sesion = useSessionUsuario();
  const esPropietaria = sesion.status === "listo" && sesion.rol === "propietaria";
  const equipo = useQuery(api.usuarios.listarEquipo, esPropietaria ? {} : "skip");

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [enEdicion, setEnEdicion] = useState<PersonaEnEdicion | null>(null);
  const [enBorrado, setEnBorrado] = useState<PersonaEnEdicion | null>(null);
  // `PersonaOverlay` toma sus valores iniciales de `persona` solo en el
  // primer render (ver su comentario) — este contador fuerza un remount
  // cada vez que se abre, para que nunca arranque con datos obsoletos de
  // la vez anterior (mismo patrón que `EditarClienteOverlay`/Ficha).
  const [personaOverlayKey, setPersonaOverlayKey] = useState(0);

  if (sesion.status === "cargando" || sesion.status === "sin_sesion") {
    return null;
  }

  if (!esPropietaria) {
    return (
      <ViewTransition default="tab-fade">
        <div className="flex h-full items-center justify-center p-5">
          <EmptyState
            icon={UserCog}
            title="Acceso restringido"
            description="Solo la Dueña puede gestionar el equipo."
          />
        </div>
      </ViewTransition>
    );
  }

  const cargando = equipo === undefined;
  const cantidadPropietarias = cargando ? 0 : equipo.filter((u) => u.rol === "propietaria").length;

  return (
    <ViewTransition default="tab-fade">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-5 pb-24">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-[var(--tracking-tight)]">Equipo</h1>
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                setEnEdicion(null);
                setPersonaOverlayKey((k) => k + 1);
                setAltaAbierta(true);
              }}
            >
              <Plus size={16} strokeWidth={2} />
              Nueva persona
            </Button>
          </div>

          {cargando && (
            <ul className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i}>
                  <Card className="flex flex-col gap-2">
                    <div className="h-4 w-1/3 animate-pulse rounded-(--radius-sm) bg-(--color-surface-2)" />
                    <div className="h-3 w-1/5 animate-pulse rounded-(--radius-sm) bg-(--color-surface-2)" />
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {!cargando && equipo.length === 0 && (
            <EmptyState
              icon={UserCog}
              title="Todavía no hay nadie en el equipo"
              description="Agregá a la primera persona para que pueda iniciar sesión."
              action={
                <Button size="compact" onClick={() => setAltaAbierta(true)}>
                  Añadir persona
                </Button>
              }
            />
          )}

          {!cargando && equipo.length > 0 && (
            <ul className="flex flex-col gap-2">
              {equipo.map((persona) => {
                const esUnoMismo = sesion.usuarioId === persona._id;
                const esUnicaPropietaria = persona.rol === "propietaria" && cantidadPropietarias <= 1;
                const sinEliminar = esUnoMismo || esUnicaPropietaria;
                const motivoSinEliminar = esUnoMismo
                  ? "No podés eliminarte a ti misma."
                  : esUnicaPropietaria
                    ? "Debe existir al menos una Dueña."
                    : undefined;

                return (
                  <li key={persona._id}>
                    <Card className="flex items-center gap-3">
                      <Avatar nombre={persona.nombre} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-medium">{persona.nombre}</span>
                          <Badge tone={persona.rol === "propietaria" ? "primary" : "neutral"}>
                            {ROLES[persona.rol]}
                          </Badge>
                        </div>
                        <span className="truncate text-[13px] text-(--color-text-subtle)">
                          {persona.email}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Editar a ${persona.nombre}`}
                          onClick={() => {
                            setEnEdicion(persona);
                            setPersonaOverlayKey((k) => k + 1);
                            setAltaAbierta(true);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-(--radius-md) text-(--color-text-subtle) hover:bg-(--color-surface-2)"
                        >
                          <Pencil size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Eliminar a ${persona.nombre}`}
                          title={motivoSinEliminar}
                          disabled={sinEliminar}
                          onClick={() => setEnBorrado(persona)}
                          className="flex h-9 w-9 items-center justify-center rounded-(--radius-md) text-(--color-text-subtle) hover:bg-(--color-surface-2) disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <Trash2 size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}

          <PersonaOverlay
            key={personaOverlayKey}
            open={altaAbierta}
            onClose={() => {
              setAltaAbierta(false);
              setEnEdicion(null);
            }}
            persona={enEdicion}
          />
          <EliminarPersonaOverlay
            open={enBorrado !== null}
            onClose={() => setEnBorrado(null)}
            persona={enBorrado}
          />
        </div>
      </div>
    </ViewTransition>
  );
}
