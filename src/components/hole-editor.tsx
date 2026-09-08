"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Hole } from "@prisma/client";
import { updateHole } from "@/actions/holes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { holeResultLabel } from "@/lib/golf";

export function HoleEditor({ roundId, hole }: { roundId: string; hole: Hole }) {
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
        toast.success(`Hoyo ${hole.number} guardado`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se ha podido guardar");
      }
    });
  }

  const strokesNum = strokes === "" ? null : Number(strokes);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl">Hoyo {hole.number}</h2>
        {strokesNum != null && (
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            {holeResultLabel(par, strokesNum)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="par">Par</Label>
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
          <Label htmlFor="distance">Distancia (m)</Label>
          <Input
            id="distance"
            type="number"
            min={0}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="putts">Putts</Label>
          <Input
            id="putts"
            type="number"
            min={0}
            value={putts}
            onChange={(e) => setPutts(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="strokes">Golpes</Label>
        <Input
          id="strokes"
          type="number"
          min={1}
          value={strokes}
          onChange={(e) => setStrokes(e.target.value)}
          placeholder="Golpes jugados en este hoyo"
          className="text-lg"
        />
      </div>

      <Button onClick={save} disabled={isPending} className="w-full">
        {isPending ? "Guardando…" : "Guardar hoyo"}
      </Button>
    </div>
  );
}
