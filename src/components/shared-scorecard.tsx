"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { saveHoleScores } from "@/actions/games";
import { holeResultLabel } from "@/lib/golf";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

export type ScorecardPlayer = { id: string; name: string; strokes: number | null };

const STROKE_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

/**
 * El scorecard durante la vuelta (Focus Mode): un jugador con el móvil en
 * la mano toca el número de golpes de cada compañero, uno detrás de otro,
 * y guarda al instante — nada de steppers ni botón "Guardar" aparte, ver
 * brief "Miro → toco → guardado → siguiente hoyo".
 */
export function SharedScorecard({
  gameId,
  hole,
  players,
  onSaved,
  t,
  golfResult,
}: {
  gameId: string;
  hole: { id: string; number: number; par: number };
  players: ScorecardPlayer[];
  onSaved: () => void;
  t: Dictionary["playGame"];
  golfResult: Dictionary["golfResult"];
}) {
  const [playerIndex, setPlayerIndex] = useState(() => {
    const firstUnset = players.findIndex((p) => p.strokes == null);
    return firstUnset === -1 ? 0 : firstUnset;
  });
  const [confirmation, setConfirmation] = useState<{ strokes: number; label: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const player = players[playerIndex];

  function pick(strokes: number) {
    if (isBusy) return;
    setIsBusy(true);
    saveHoleScores({ gameId, holeId: hole.id, entries: [{ playerId: player.id, strokes, putts: null }] })
      .then(() => {
        setConfirmation({ strokes, label: holeResultLabel(hole.par, strokes, golfResult) });
        setTimeout(() => {
          setConfirmation(null);
          setIsBusy(false);
          if (playerIndex + 1 < players.length) {
            setPlayerIndex((i) => i + 1);
          } else {
            onSaved();
          }
        }, 1100);
      })
      .catch((err) => {
        setIsBusy(false);
        toast.error(err instanceof Error ? err.message : t.saveError);
      });
  }

  if (confirmation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-9" />
        </span>
        <p className="font-heading text-3xl font-semibold">{fmt(t.strokesCount, { n: confirmation.strokes })}</p>
        <p className="text-lg text-muted-foreground">{confirmation.label}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t.nextHolePrompt}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-6 py-8 text-center">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{fmt(t.hole, { n: hole.number })}</h1>
        <p className="mt-1 text-lg text-muted-foreground">
          {t.par} {hole.par}
        </p>
      </div>

      <div>
        {players.length > 1 && <p className="text-sm font-medium text-muted-foreground">{player.name}</p>}
        <p className="mt-1 font-heading text-xl font-semibold">{t.howManyStrokes}</p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-4 gap-3">
        {STROKE_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={isBusy}
            onClick={() => pick(n)}
            className="flex aspect-square items-center justify-center rounded-2xl bg-secondary font-heading text-2xl font-semibold text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
