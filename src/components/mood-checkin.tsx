"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Mood } from "@prisma/client";
import { createMoodEntry } from "@/actions/mood";
import { MoodPicker } from "@/components/mood-picker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function MoodCheckin({
  roundId,
  holeId,
  label = "¿Cómo te sientes tras este hoyo?",
}: {
  roundId: string;
  holeId?: string;
  label?: string;
}) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!mood) {
      toast.error("Elige cómo te sientes primero");
      return;
    }
    startTransition(async () => {
      try {
        await createMoodEntry({ roundId, holeId, mood, note });
        toast.success("Check-in guardado");
        setMood(null);
        setNote("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se ha podido guardar");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
      <p className="text-sm font-medium">{label}</p>
      <MoodPicker name="mood" onChange={setMood} defaultValue={mood} />
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota opcional"
        rows={2}
      />
      <Button size="sm" onClick={save} disabled={isPending} className="self-start">
        {isPending ? "Guardando…" : "Guardar check-in"}
      </Button>
    </div>
  );
}
