"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { saveHoleScores } from "@/actions/games";
import { holeResultLabel } from "@/lib/golf";
import { strokesReceivedOnHole } from "@/lib/games/handicap";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

export type ScorecardPlayer = { id: string; name: string; handicap: number | null; strokes: number | null };

const STROKE_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

/**
 * El scorecard durante la vuelta (Focus Mode): un jugador con el móvil en
 * la mano toca el número de golpes de cada compañero, uno detrás de otro,
 * y guarda al instante — nada de steppers, selector de palo ni botón
 * "Guardar" aparte. Ver brief: "miro → toco → guardado → siguiente
 * hoyo", vuelto a esto tras comprobar que el registro golpe a golpe
 * (palo por palo) estorbaba más de lo que ayudaba en la práctica.
 */
export function SharedScorecard({
  gameId,
  hole,
  totalHoles,
  players,
  onSaved,
  t,
  golfResult,
}: {
  gameId: string;
  hole: { id: string; number: number; par: number; distance: number | null; index: number | null };
  totalHoles: number;
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
  const strokesReceived =
    hole.index != null && player.handicap != null ? strokesReceivedOnHole(player.handicap, hole.index) : 0;

  function pick(strokes: number) {
    if (isBusy) return;
    setIsBusy(true);
    saveHoleScores({ gameId, holeId: hole.id, entries: [{ playerId: player.id, strokes, putts: null, club: null }] })
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
    <div className="flex flex-1 flex-col items-center gap-6 px-6 py-6 text-center">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {fmt(t.hole, { n: hole.number, total: totalHoles })}
        </h1>
        <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-lg text-muted-foreground">
          <span>
            {t.par} {hole.par}
          </span>
          {hole.distance != null && (
            <>
              <span className="text-border">·</span>
              <span>{fmt(t.distanceMeters, { n: hole.distance })}</span>
            </>
          )}
          {hole.index != null && (
            <>
              <span className="text-border">·</span>
              <span>{fmt(t.strokeIndexShort, { n: hole.index })}</span>
            </>
          )}
        </p>
        {strokesReceived > 0 && (
          <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {strokesReceived === 1 ? t.strokesReceivedOne : fmt(t.strokesReceivedMany, { n: strokesReceived })}
          </span>
        )}
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
