import { ViewTransition } from "react";

/**
 * Crossfade al cambiar entre las 6 pestañas de navegación principal (ver
 * AppShell) — sin esto, tocar un icono de la barra inferior se siente como
 * una recarga de página en vez de un cambio de contenido dentro de la
 * misma app. Tiene que ir en cada page.tsx, no en el layout: el layout
 * persiste entre navegaciones, así que el enter/exit del ViewTransition
 * nunca dispararía ahí (ver Next.js docs, "Designing view transitions").
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <ViewTransition default="auto">{children}</ViewTransition>;
}
