"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, Loader2, MoreHorizontal } from "lucide-react";
import { SharedScorecard } from "@/components/shared-scorecard";
import { MindQuickCard } from "@/components/mind-quick-card";
import { FinishGameDrawer } from "@/components/finish-game-drawer";
import { finishGame } from "@/actions/games";
import { gamePlayingHandicapForIndex } from "@/lib/games/handicap";
import { setBackButtonHandler } from "@/lib/native/back-button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

type GameForView = {
  id: string;
  course: string;
  totalHoles: number;
  teeCourseRating: number | null;
  teeSlope: number | null;
  teeParTotal: number | null;
  teeHoleCount: number | null;
  handicapAllowance: number | null;
  holes: { id: string; number: number; par: number; distance: number | null; index: number | null }[];
  players: {
    id: string;
    user: { name: string | null; handicap: number | null };
    playingHandicap: number | null;
    scores: { holeId: string; strokes: number | null }[];
  }[];
};

/**
 * Focus Mode: durante la vuelta la app no muestra nada más que el
 * scorecard — sin standings, sin retos, sin chat con el compañero. Ver
 * brief: "durante la vuelta, Mind desaparece." El icono de Mind en la
 * cabecera abre una tarjeta corta en el sitio (MindQuickCard), nunca el
 * chat completo — Mind nunca interrumpe solo. Al volver, la vuelta
 * reanuda exactamente donde estaba porque la posición del hoyo se
 * recalcula siempre a partir de lo ya guardado en base de datos, no de
 * estado local.
 */
export function GameView({
  game,
  t,
  golfResult,
}: {
  game: GameForView;
  t: Dictionary["playGame"];
  golfResult: Dictionary["golfResult"];
}) {
  const firstUnplayedIndex = game.holes.findIndex((h) =>
    game.players.some((p) => p.scores.find((s) => s.holeId === h.id)?.strokes == null)
  );
  const [holeIndex, setHoleIndex] = useState(firstUnplayedIndex === -1 ? game.holes.length - 1 : firstUnplayedIndex);
  const router = useRouter();
  const [isFinishing, startFinishing] = useTransition();
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);

  const hole = game.holes[holeIndex];
  const isLastHole = holeIndex === game.holes.length - 1;

  // Botón/gesto atrás de Android: mientras se está jugando, no debe salir
  // de la partida directamente — muestra la misma confirmación que
  // "Finalizar partida" del menú, en vez del comportamiento por defecto
  // del WebView. Un único listener global vive en NativeAppInit (ver
  // back-button.ts); aquí solo se registra/quita el handler mientras
  // Focus Mode está montado, nunca el listener de Capacitor en sí.
  useEffect(() => {
    setBackButtonHandler(() => setConfirmFinishOpen(true));
    return () => setBackButtonHandler(null);
  }, []);

  const players = useMemo(
    () =>
      game.players.map((p) => {
        const score = p.scores.find((s) => s.holeId === hole.id);
        return {
          id: p.id,
          name: p.user.name ?? "Jugador",
          // Playing Handicap CONGELADO al incorporarse a la partida
          // (GamePlayer.playingHandicap) — fuente de verdad. Solo se
          // recalcula en vivo como fallback para GamePlayer creados antes
          // de esta foto por jugador (filas legacy con el campo null).
          handicap: p.playingHandicap ?? gamePlayingHandicapForIndex(game, p.user.handicap),
          strokes: score?.strokes ?? null,
        };
      }),
    [game, hole.id]
  );

  function goToNextHole() {
    if (isLastHole) {
      startFinishing(async () => {
        await finishGame(game.id);
        router.push(`/play/${game.id}/resumen`);
      });
    } else {
      setHoleIndex((i) => i + 1);
    }
  }

  function confirmFinish() {
    setConfirmFinishOpen(false);
    startFinishing(async () => {
      await finishGame(game.id);
      router.push(`/play/${game.id}/resumen`);
    });
  }

  return (
    // Focus Mode se pinta por encima de TODO (fixed inset-0, z por delante
    // del header/bottom nav de AppShell): "durante la vuelta, la app
    // desaparece" — nada de navegación inferior ni cabecera de la app
    // visibles ni pulsables mientras se juega. Franja de foto arriba (misma
    // identidad visual que el resto de Jugar) + hoja blanca redondeada
    // debajo con el scorecard real, sin quitar ningún control existente
    // (hoyo anterior, Mind, terminar antes) — solo reubicados sobre la foto.
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="relative h-[26vh] min-h-[190px] shrink-0 overflow-hidden">
        <Image
          src="/images/play-hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_70%]"
          priority
        />
        <div className="relative flex h-full flex-col justify-between px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setHoleIndex((i) => Math.max(0, i - 1))}
              disabled={holeIndex === 0}
              className="flex items-center gap-1 rounded-full bg-white/15 py-1 pr-2.5 pl-1.5 text-sm text-white backdrop-blur-sm disabled:opacity-0"
            >
              <ChevronLeft className="size-4" />
              {t.previousHole}
            </button>
            <p className="truncate px-2 text-xs font-medium text-white/85">{game.course}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <MindQuickCard gameId={game.id} holeId={hole.id} t={t.quickCoach} />
              {/* En el último hoyo, guardar el resultado ya termina la
                  partida — no hay ninguna acción útil que ofrecer aquí, así
                  que el menú entero desaparece en vez de dejar un "⋯" sin
                  nada dentro. */}
              {!isLastHole && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t.moreOptionsLabel}
                    className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setConfirmFinishOpen(true)}>{t.finishEarly}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="text-center text-white">
            <h1 className="font-heading text-3xl font-bold">
              {fmt(t.hole, { n: hole.number, total: game.holes.length })}
            </h1>
            <p className="mt-0.5 text-base text-white/85">
              {t.par} {hole.par}
            </p>
          </div>
        </div>
      </div>

      <div className="relative -mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl bg-background pb-[env(safe-area-inset-bottom)]">
        {isFinishing ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p>{t.saving}</p>
          </div>
        ) : (
          <SharedScorecard
            key={hole.id}
            gameId={game.id}
            hole={hole}
            players={players}
            onSaved={goToNextHole}
            t={t}
            golfResult={golfResult}
          />
        )}
      </div>

      <FinishGameDrawer open={confirmFinishOpen} onOpenChange={setConfirmFinishOpen} onConfirm={confirmFinish} t={t} />
    </div>
  );
}
