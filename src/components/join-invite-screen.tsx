import Image from "next/image";
import { LogIn, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type JoinInviteScreenProps =
  | { variant: "not-found"; t: Dictionary["joinGame"] }
  | {
      variant: "full" | "needs-auth" | "joinable";
      course: string;
      layoutName: string | null;
      teeName: string | null;
      holesLabel: string;
      hostName: string | null;
      started: boolean;
      t: Dictionary["joinGame"];
      /** Server action ya ligada al código (signInWithGoogleAndRedirect.bind(null, joinPath(code))). Solo en "needs-auth". */
      loginAction?: (formData: FormData) => Promise<void>;
      /** Server action ya ligada al código (joinGame.bind(null, code)). Solo en "joinable". */
      joinAction?: (formData: FormData) => Promise<void>;
    };

/**
 * Pantalla móvil mínima de "unirse a una partida" — puerta de entrada
 * desde un enlace de invitación (WhatsApp, compartir, copiar), NUNCA una
 * segunda versión de la app: sin barra de navegación, sin más pantallas
 * que esta. Pensada primero para iPhone/Android en una mano: foto arriba,
 * ficha con lo justo para identificar la partida, y un único botón grande
 * y fijo abajo (iniciar sesión o unirse, según el estado).
 */
export function JoinInviteScreen(props: JoinInviteScreenProps) {
  if (props.variant === "not-found") {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
        <Users className="size-8 text-muted-foreground" />
        <h1 className="font-heading text-xl font-semibold">{props.t.notFoundTitle}</h1>
        <p className="max-w-xs text-sm text-muted-foreground">{props.t.notFoundBody}</p>
      </div>
    );
  }

  const { course, layoutName, teeName, holesLabel, hostName, started, t } = props;
  const courseLine = layoutName ? `${course} · ${layoutName}` : course;
  const formatLine = teeName ? `${holesLabel} · ${teeName}` : holesLabel;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background">
      <div className="relative flex h-[26vh] min-h-[180px] shrink-0 flex-col justify-end overflow-hidden px-6 pt-[env(safe-area-inset-top)] pb-5">
        <Image src={DASHBOARD_PHOTOS.play} alt="" fill sizes="100vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/25 to-black/60" />
        <div className="relative flex flex-col items-center gap-1 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Users className="size-5 text-white" />
          </span>
          <h1 className="font-heading text-xl font-bold text-white">
            {hostName ? fmt(t.invite, { name: hostName, course }) : courseLine}
          </h1>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-sm min-h-0 flex-1 flex-col gap-3 rounded-t-3xl bg-background px-6 pt-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="rounded-2xl border border-border/70 bg-card p-4 text-center shadow-sm">
          <p className="font-heading text-base font-semibold">{courseLine}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatLine}</p>
        </div>

        {started && <p className="text-center text-xs text-muted-foreground">{t.startedNote}</p>}

        {props.variant === "full" && (
          <p className="text-center text-sm font-medium text-muted-foreground">{t.full}</p>
        )}

        <div className="min-h-0 flex-1" />

        {props.variant === "needs-auth" && (
          <form action={props.loginAction}>
            <p className="mb-3 text-center text-sm text-muted-foreground">{t.loginPrompt}</p>
            <Button type="submit" size="lg" className="h-12 w-full gap-2 rounded-2xl text-base">
              <LogIn className="size-5" />
              {t.loginCta}
            </Button>
          </form>
        )}

        {props.variant === "joinable" && (
          <form action={props.joinAction}>
            <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base">
              {t.join}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
