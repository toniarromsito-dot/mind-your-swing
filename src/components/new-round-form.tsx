"use client";

import { useActionState } from "react";
import { createRound } from "@/actions/rounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoodPicker } from "@/components/mood-picker";

const HOLE_OPTIONS = [9, 18];

export function NewRoundForm() {
  const [state, formAction, pending] = useActionState(createRound, undefined);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="course">Campo</Label>
        <Input id="course" name="course" placeholder="Ej. Club de Golf Las Encinas" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="totalHoles">Nº de hoyos</Label>
          <select
            id="totalHoles"
            name="totalHoles"
            defaultValue={18}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
          >
            {HOLE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="goal">Objetivo del día (opcional)</Label>
        <Input id="goal" name="goal" placeholder="Ej. Disfrutar y no arrastrar un mal hoyo" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
        <div>
          <p className="font-medium">¿Cómo llegas hoy?</p>
          <p className="text-sm text-muted-foreground">
            Un check-in rápido antes de empezar, opcional.
          </p>
        </div>
        <MoodPicker name="initialMood" />
        <Textarea
          name="initialNote"
          placeholder="Algo que quieras anotar (opcional)"
          rows={2}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Creando ronda…" : "Empezar ronda"}
      </Button>
    </form>
  );
}
