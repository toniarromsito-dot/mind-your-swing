"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Mood } from "@prisma/client";
import { createMoodEntry } from "@/actions/mood";
import { MoodPicker } from "@/components/mood-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function MoodCheckin({
  gameId,
  holeId,
  t,
  moodLabels,
}: {
  gameId?: string;
  holeId?: string;
  t: Dictionary["moodCheckin"];
  moodLabels: Dictionary["mood"];
}) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!mood) {
      toast.error(t.chooseMoodFirst);
      return;
    }
    startTransition(async () => {
      try {
        await createMoodEntry({ gameId, holeId, mood, note });
        toast.success(t.checkinSaved);
        setMood(null);
        setNote("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.saveError);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-medium">{t.moodCheckinLabel}</p>
      <MoodPicker name="mood" onChange={setMood} defaultValue={mood} t={moodLabels} />
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t.notePlaceholder}
        rows={2}
      />
      <Button size="sm" onClick={save} disabled={isPending} className="self-start">
        {isPending ? t.saving : t.saveCheckin}
      </Button>
    </div>
  );
}
