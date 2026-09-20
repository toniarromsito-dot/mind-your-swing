import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Flecha de vuelta de las pantallas interiores de Aprende (ejercicios,
 * explora, academia, tutoriales) — mismo patrón táctil que la cabecera de
 * /aprende/videos (círculo sólido, sin depender de hover), ahora que todas
 * son inmersivas (ver isImmersivePage en app-shell.tsx) y ya no heredan la
 * flecha del header global.
 */
export function AprendeBackLink({ label }: { label: string }) {
  return (
    <Link
      href="/aprende"
      aria-label={label}
      className="flex size-9 w-fit shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:bg-secondary/70"
    >
      <ChevronLeft className="size-5" />
    </Link>
  );
}
