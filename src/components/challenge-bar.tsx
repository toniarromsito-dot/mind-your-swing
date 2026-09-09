"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { markChallengeWin } from "@/actions/games";
import { CHALLENGE_KEYS } from "@/lib/games/modes";
import type { StandingsPlayer } from "@/lib/games/standings";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

/**
 * Marca manual de mini-retos (más cercano a bandera, mejor drive...) — sin
 * detección automática por GPS, la marca cualquier jugador de la partida.
 */
export function ChallengeBar({
  gameId,
  holeId,
  players,
  t,
}: {
  gameId: string;
  holeId: string;
  players: StandingsPlayer[];
  t: Dictionary["playGame"];
}) {
  const [openChallenge, setOpenChallenge] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function mark(challengeKey: string, playerId: string) {
    startTransition(async () => {
      try {
        await markChallengeWin({ gameId, challengeKey, playerId, holeId });
        toast.success(t.challengeMarked);
        setOpenChallenge(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.saveError);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/20 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Trophy className="size-4" />
        {t.challengesTitle}
      </p>
      <div className="flex flex-wrap gap-2">
        {CHALLENGE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setOpenChallenge(openChallenge === key ? null : key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs transition-colors",
              openChallenge === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary/60"
            )}
          >
            {t.challengeLabels[key]}
          </button>
        ))}
      </div>
      {openChallenge && (
        <div className="flex flex-wrap gap-2 pt-1">
          {players.map((p) => (
            <button
              key={p.playerId}
              type="button"
              disabled={isPending}
              onClick={() => mark(openChallenge, p.playerId)}
              className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/70 disabled:opacity-50"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
