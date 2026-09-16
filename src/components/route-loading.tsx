import { Loader2 } from "lucide-react";

/**
 * loading.tsx de cada pestaña principal (ver AppShell) — sin esto, tocar
 * un icono de la barra inferior no daba ningún feedback hasta que los
 * datos del servidor llegaban del todo, y con el crossfade de
 * PageTransition esa espera se notaba más, no menos. Esto aparece al
 * instante; el contenido real hace su propio crossfade al llegar.
 */
export function RouteLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
