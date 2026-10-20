"use client";

import { useState, ViewTransition } from "react";
import Link from "next/link";
import { ChevronRight, KeyRound, LogOut, Pencil, UserCog } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ROLES } from "@/lib/constants";
import { useSessionUsuario } from "@/lib/session";
import { EditarNombreOverlay } from "./editar-nombre-overlay";
import { CambiarContrasenaOverlay } from "./cambiar-contrasena-overlay";
import { CerrarSesionOverlay } from "./cerrar-sesion-overlay";

/** MID-8: Perfil / Mi cuenta — autogestión básica + acceso a Equipo si es Dueña. */
export default function CuentaPage() {
  const sesion = useSessionUsuario();
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [cambiandoContrasena, setCambiandoContrasena] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  // Mismo motivo que en `equipo/page.tsx`: `EditarNombreOverlay` toma su
  // valor inicial de `nombreActual` solo en el primer render.
  const [editarNombreKey, setEditarNombreKey] = useState(0);

  if (sesion.status !== "listo") return null;

  const { nombre, rol } = sesion;

  return (
    <ViewTransition default="tab-fade">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[480px] flex-col gap-5 p-5 pb-24">
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <Avatar nombre={nombre} className="h-16 w-16 text-lg" />
            <h1 className="text-xl font-semibold tracking-[var(--tracking-tight)]">{nombre}</h1>
            <span className="text-[13px] text-(--color-text-subtle)">{ROLES[rol]}</span>
          </div>

          <Card className="flex flex-col divide-y divide-(--color-border) p-0">
            <OpcionCuenta
              icon={Pencil}
              label="Editar mis datos"
              onClick={() => {
                setEditarNombreKey((k) => k + 1);
                setEditandoNombre(true);
              }}
            />
            <OpcionCuenta
              icon={KeyRound}
              label="Cambiar contraseña"
              onClick={() => setCambiandoContrasena(true)}
            />
            {rol === "propietaria" && (
              <Link
                href="/equipo"
                className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-(--color-text) hover:bg-(--color-surface-2)"
              >
                <UserCog size={18} strokeWidth={1.5} className="text-(--color-text-subtle)" />
                <span className="flex-1">Usuarios</span>
                <ChevronRight size={16} strokeWidth={1.5} className="text-(--color-text-subtle)" />
              </Link>
            )}
          </Card>

          <Card className="p-0">
            <button
              type="button"
              onClick={() => setCerrandoSesion(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-(--color-error-text) hover:bg-(--color-error-bg)"
            >
              <LogOut size={18} strokeWidth={1.5} />
              Cerrar sesión
            </button>
          </Card>
        </div>
      </div>

      <EditarNombreOverlay
        key={editarNombreKey}
        open={editandoNombre}
        onClose={() => setEditandoNombre(false)}
        nombreActual={nombre}
      />
      <CambiarContrasenaOverlay open={cambiandoContrasena} onClose={() => setCambiandoContrasena(false)} />
      <CerrarSesionOverlay open={cerrandoSesion} onClose={() => setCerrandoSesion(false)} />
    </ViewTransition>
  );
}

function OpcionCuenta({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-(--color-text) hover:bg-(--color-surface-2)"
    >
      <Icon size={18} strokeWidth={1.5} className="text-(--color-text-subtle)" />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight size={16} strokeWidth={1.5} className="text-(--color-text-subtle)" />
    </button>
  );
}
