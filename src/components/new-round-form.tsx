"use client";

import { useActionState } from "react";
import { createRound } from "@/actions/rounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoodPicker } from "@/components/mood-picker";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const HOLE_OPTIONS = [9, 18];

export function NewRoundForm({
  t,
  moodLabels,
}: {
  t: Dictionary["newRound"];
  moodLabels: Dictionary["mood"];
}) {
  const [state, formAction, pending] = useActionState(createRound, undefined);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="course">{t.course}</Label>
        <Input id="course" name="course" placeholder={t.coursePlaceholder} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="date">{t.date}</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="totalHoles">{t.totalHoles}</Label>
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
        <Label htmlFor="goal">{t.goal}</Label>
        <Input id="goal" name="goal" placeholder={t.goalPlaceholder} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
        <div>
          <p className="font-medium">{t.moodPrompt}</p>
          <p className="text-sm text-muted-foreground">{t.moodPromptSubtitle}</p>
        </div>
        <MoodPicker name="initialMood" t={moodLabels} />
        <Textarea name="initialNote" placeholder={t.notePlaceholder} rows={2} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
