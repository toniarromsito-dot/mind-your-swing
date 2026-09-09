"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
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
 * brief §2-3: "la aplicación debe desaparecer."
 */
export function GameView({ game, t }: { game: GameForView; t: Dictionary["playGame"] }) {
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
        <span className="w-16" />
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
          players={players}
          isLastHole={isLastHole}
          onSaved={goToNextHole}
          t={t}
        />
      )}
    </div>
  );
}
