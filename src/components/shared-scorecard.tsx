"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveHoleScores } from "@/actions/games";
import { ScoreStepper } from "@/components/score-stepper";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

export type ScorecardPlayer = { id: string; name: string; strokes: number | null };

/**
 * El scorecard durante la vuelta (Focus Mode): un jugador con el móvil en
 * la mano anota los golpes de TODO el grupo en un solo hoyo y guarda de
 * una vez — nada de standings, retos ni chat aquí, ver brief §2-3.
 */
export function SharedScorecard({
  gameId,
  hole,
  players,
  isLastHole,
  onSaved,
  t,
}: {
  gameId: string;
  hole: { id: string; number: number; par: number };
  players: ScorecardPlayer[];
  isLastHole: boolean;
  onSaved: () => void;
  t: Dictionary["playGame"];
}) {
  const [values, setValues] = useState<Map<string, number | null>>(
    () => new Map(players.map((p) => [p.id, p.strokes]))
  );
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await saveHoleScores({
          gameId,
          holeId: hole.id,
          entries: players.map((p) => ({ playerId: p.id, strokes: values.get(p.id) ?? null, putts: null })),
        });
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.saveError);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 text-center">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">{fmt(t.hole, { n: hole.number })}</h1>
        <p className="mt-1 text-lg text-muted-foreground">
          {t.par} {hole.par}
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        {players.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4">
            <span className="text-lg font-medium">{p.name}</span>
            <ScoreStepper
              label={t.strokes}
              value={values.get(p.id) ?? null}
              onChange={(v) => setValues((prev) => new Map(prev).set(p.id, v))}
            />
          </div>
        ))}
      </div>

      <Button size="lg" className="h-14 w-full max-w-sm rounded-2xl text-base" disabled={isPending} onClick={save}>
        {isPending ? t.saving : isLastHole ? t.finish : t.saveHole}
      </Button>
    </div>
  );
}
