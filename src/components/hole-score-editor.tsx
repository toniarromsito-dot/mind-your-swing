"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveScore } from "@/actions/games";
import { ScoreStepper } from "@/components/score-stepper";
import { holeResultLabel } from "@/lib/golf";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

export function HoleScoreEditor({
  gameId,
  hole,
  myStrokes,
  myPutts,
  t,
  golfLabels,
}: {
  gameId: string;
  hole: { id: string; number: number; par: number; distance: number | null };
  myStrokes: number | null;
  myPutts: number | null;
  t: Dictionary["playGame"];
  golfLabels: Dictionary["golfResult"];
}) {
  const [strokes, setStrokes] = useState<number | null>(myStrokes);
  const [putts, setPutts] = useState<number | null>(myPutts);
  const [isPending, startTransition] = useTransition();

  function commit(nextStrokes: number | null, nextPutts: number | null) {
    startTransition(async () => {
      try {
        await saveScore(gameId, { holeId: hole.id, strokes: nextStrokes, putts: nextPutts });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.saveError);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl">{fmt(t.hole, { n: hole.number })}</h2>
          <p className="text-sm text-muted-foreground">
            {t.par} {hole.par}
            {hole.distance ? ` · ${hole.distance}m` : ""}
          </p>
        </div>
        {strokes != null && (
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            {holeResultLabel(hole.par, strokes, golfLabels)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-8">
        <ScoreStepper
          label={t.strokes}
          value={strokes}
          onChange={(v) => {
            setStrokes(v);
            commit(v, putts);
          }}
        />
        <ScoreStepper
          label={t.putts}
          value={putts}
          min={0}
          max={10}
          onChange={(v) => {
            setPutts(v);
            commit(strokes, v);
          }}
        />
      </div>

      {isPending && <p className="text-center text-xs text-muted-foreground">{t.saving}</p>}
    </div>
  );
}
