"use client";

import { useState } from "react";
import type { Mood } from "@prisma/client";
import { MOOD_EMOJI, MOOD_LABELS } from "@/lib/mood";
import { cn } from "@/lib/utils";

const MOODS: Mood[] = ["TRANQUILO", "NERVIOSO", "FRUSTRADO", "CONFIADO", "CONCENTRADO"];

export function MoodPicker({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue?: Mood | null;
  onChange?: (mood: Mood) => void;
}) {
  const [selected, setSelected] = useState<Mood | null>(defaultValue ?? null);

  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={selected ?? ""} />
      {MOODS.map((mood) => {
        const isSelected = selected === mood;
        return (
          <button
            key={mood}
            type="button"
            onClick={() => {
              setSelected(mood);
              onChange?.(mood);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-secondary/60"
            )}
          >
            <span className="text-base leading-none">{MOOD_EMOJI[mood]}</span>
            {MOOD_LABELS[mood]}
          </button>
        );
      })}
    </div>
  );
}
