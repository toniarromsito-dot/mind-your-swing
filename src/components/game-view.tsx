"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, MoreHorizontal } from "lucide-react";
import { SharedScorecard } from "@/components/shared-scorecard";
import { MindQuickCard } from "@/components/mind-quick-card";
import { finishGame } from "@/actions/games";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type ShotForView = { id: string; club: string; distanceMeters: number | null; sequence: number };

type GameForView = {
  id: string;
  course: string;
  totalHoles: number;
  holes: { id: string; number: number; par: number; distance: number | null; index: number | null }[];
  players: {
    id: string;
    user: { name: string | null; handicap: number | null };
    scores: { holeId: string; strokes: number | null; shots: ShotForView[] }[];
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

  const hole = game.holes[holeIndex];
  const isLastHole = holeIndex === game.holes.length - 1;

  const players = useMemo(
    () =>
      game.players.map((p) => {
        const score = p.scores.find((s) => s.holeId === hole.id);
        return {
          id: p.id,
          name: p.user.name ?? "Jugador",
          handicap: p.user.handicap,
          strokes: score?.strokes ?? null,
          shots: score?.shots ?? [],
        };
      }),
    [game.players, hole.id]
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

  function finishEarly() {
    if (!window.confirm(t.finishEarlyConfirm)) return;
    startFinishing(async () => {
      await finishGame(game.id);
      router.push(`/play/${game.id}/resumen`);
    });
  }

  return (
    // Focus Mode se pinta por encima de TODO (fixed inset-0, z por delante
    // del header/bottom nav de AppShell): "durante la vuelta, la app
    // desaparece" — nada de navegación inferior ni cabecera de la app
    // visibles ni pulsables mientras se juega. pt/pb con env(safe-area-*)
    // porque esta pantalla ya no hereda el padding del <main> de AppShell.
    <div className="fixed inset-0 z-40 flex flex-col bg-background pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-between px-3">
        <button
          type="button"
          onClick={() => setHoleIndex((i) => Math.max(0, i - 1))}
          disabled={holeIndex === 0}
          className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-0"
        >
          <ChevronLeft className="size-4" />
          {t.previousHole}
        </button>
        <p className="truncate px-2 text-sm font-medium text-muted-foreground">{game.course}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <MindQuickCard gameId={game.id} holeId={hole.id} t={t.quickCoach} />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t.moreOptionsLabel}
              className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>{t.keepPlaying}</DropdownMenuItem>
              {!isLastHole && <DropdownMenuItem onClick={finishEarly}>{t.finishEarly}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
          totalHoles={game.holes.length}
          players={players}
          onSaved={goToNextHole}
          t={t}
          golfResult={golfResult}
        />
      )}
    </div>
  );
}
