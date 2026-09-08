"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Hole } from "@prisma/client";
import { updateHole } from "@/actions/holes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { holeResultLabel } from "@/lib/golf";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

export function HoleEditor({
  roundId,
  hole,
  t,
  golfLabels,
}: {
  roundId: string;
  hole: Hole;
  t: Dictionary["round"];
  golfLabels: Dictionary["golfResult"];
}) {
  const [par, setPar] = useState(hole.par);
  const [distance, setDistance] = useState(hole.distance?.toString() ?? "");
  const [strokes, setStrokes] = useState(hole.strokes?.toString() ?? "");
  const [putts, setPutts] = useState(hole.putts?.toString() ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateHole(roundId, {
          holeId: hole.id,
          par,
          distance: distance === "" ? null : Number(distance),
          strokes: strokes === "" ? null : Number(strokes),
          putts: putts === "" ? null : Number(putts),
        });
        toast.success(fmt(t.holeSaved, { n: hole.number }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.saveError);
      }
    });
  }

  const strokesNum = strokes === "" ? null : Number(strokes);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl">{fmt(t.hole, { n: hole.number })}</h2>
        {strokesNum != null && (
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            {holeResultLabel(par, strokesNum, golfLabels)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="par">{t.par}</Label>
          <Input
            id="par"
            type="number"
            min={3}
            max={6}
            value={par}
            onChange={(e) => setPar(Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="distance">{t.distance}</Label>
          <Input
            id="distance"
            type="number"
            min={0}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder={t.optional}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="putts">{t.putts}</Label>
          <Input
            id="putts"
            type="number"
            min={0}
            value={putts}
            onChange={(e) => setPutts(e.target.value)}
            placeholder={t.optional}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="strokes">{t.strokes}</Label>
        <Input
          id="strokes"
          type="number"
          min={1}
          value={strokes}
          onChange={(e) => setStrokes(e.target.value)}
          placeholder={t.strokesPlaceholder}
          className="text-lg"
        />
      </div>

      <Button onClick={save} disabled={isPending} className="w-full">
        {isPending ? t.saving : t.saveHole}
      </Button>
    </div>
  );
}
