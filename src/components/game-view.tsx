"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Home } from "lucide-react";
import { SharedScorecard } from "@/components/shared-scorecard";
import { finishGame } from "@/actions/games";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type GameForView = {
  id: string;
  course: string;
  totalHoles: number;
  holes: { id: string; number: number; par: number }[];
  players: {
    id: string;
    user: { name: string | null };
    scores: { holeId: string; strokes: number | null }[];
  }[];
};

/**
 * Focus Mode: durante la vuelta la app no muestra nada más que el
 * scorecard — sin standings, sin retos, sin chat con el compañero. Ver
 * brief: "durante la vuelta, Mind desaparece." El único acceso a Mind es
 * el icono pequeño de la cabecera, que navega fuera y nunca interrumpe
 * solo. Al volver, la vuelta reanuda exactamente donde estaba porque la
 * posición del hoyo se recalcula siempre a partir de lo ya guardado en
 * base de datos, no de estado local.
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
      game.players.map((p) => ({
        id: p.id,
        name: p.user.name ?? "Jugador",
        strokes: p.scores.find((s) => s.holeId === hole.id)?.strokes ?? null,
      })),
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
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <div className="flex items-center justify-between px-1 pt-2">
        <button
          type="button"
          onClick={() => setHoleIndex((i) => Math.max(0, i - 1))}
          disabled={holeIndex === 0}
          className="flex items-center gap-1 text-sm text-muted-foreground disabled:opacity-0"
        >
          <ChevronLeft className="size-4" />
          {t.previousHole}
        </button>
        <p className="text-sm font-medium text-muted-foreground">{game.course}</p>
        <Link
          href="/mind"
          aria-label={t.mindButtonLabel}
          className="flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Home className="size-4" />
        </Link>
      </div>

      {isFinishing ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p>{t.saving}</p>
        </div>
      ) : (
        <>
          <SharedScorecard
            key={hole.id}
            gameId={game.id}
            hole={hole}
            players={players}
            onSaved={goToNextHole}
            t={t}
            golfResult={golfResult}
          />
          {!isLastHole && (
            <button
              type="button"
              onClick={finishEarly}
              className="mx-auto mb-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {t.finishEarly}
            </button>
          )}
        </>
      )}
    </div>
  );
}
