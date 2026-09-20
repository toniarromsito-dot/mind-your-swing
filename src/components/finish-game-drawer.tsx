"use client";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Confirmación de "terminar la partida antes de tiempo" — mismo lenguaje
 * visual que el resto de la app (bottom sheet), nunca `window.confirm()`
 * (rompía la sensación de app nativa con el cuadro de sistema del
 * navegador/WebView). Se abre tanto desde el menú "⋯" del Focus Mode como
 * desde el botón/gesto atrás de Android (ver back-button.ts) — mismo
 * componente, misma acción, dos disparadores.
 */
export function FinishGameDrawer({
  open,
  onOpenChange,
  onConfirm,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  t: Dictionary["playGame"];
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t.finishConfirmTitle}</DrawerTitle>
          <DrawerDescription>{t.finishConfirmBody}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button type="button" size="lg" className="h-12 rounded-2xl text-base" onClick={() => onOpenChange(false)}>
            {t.finishConfirmKeepPlaying}
          </Button>
          <Button type="button" variant="destructive" size="lg" className="h-12 rounded-2xl text-base" onClick={onConfirm}>
            {t.finishConfirmEnd}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
