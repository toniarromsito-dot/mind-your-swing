"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

/**
 * Envoltorio genérico para mover información secundaria fuera de la
 * pantalla principal (mismo patrón que MindSettingsDrawer en /mind) — el
 * contenido lo decide quien lo usa vía children, aquí solo se gestiona el
 * abrir/cerrar. Los children pueden venir de un Server Component: pasar
 * JSX como children es válido, solo las props del propio Drawer necesitan
 * "use client".
 */
export function DetailsDrawer({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 self-center text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        <ChevronDown className="size-4" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">{children}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
