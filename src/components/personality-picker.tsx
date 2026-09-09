"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { CoachTone } from "@prisma/client";
import { updateProfile } from "@/actions/profile";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const PERSONALITIES: { key: CoachTone; emoji: string }[] = [
  { key: "CALM", emoji: "🧘" },
  { key: "MOTIVATOR", emoji: "💪" },
  { key: "COACH", emoji: "🎯" },
  { key: "FRIEND", emoji: "😄" },
];

export function PersonalityPicker({ defaultValue, t }: { defaultValue: CoachTone; t: Dictionary["mind"] }) {
  const [isPending, startTransition] = useTransition();

  function select(tone: CoachTone) {
    if (tone === defaultValue) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("coachTone", tone);
      const result = await updateProfile(undefined, formData);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {PERSONALITIES.map((p) => (
        <button
          key={p.key}
          type="button"
          disabled={isPending}
          onClick={() => select(p.key)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-colors disabled:opacity-60",
            defaultValue === p.key
              ? "border-primary bg-secondary/50"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <span className="text-2xl">{p.emoji}</span>
          <span className="text-sm font-medium">{t.personalities[p.key].label}</span>
          <span className="text-xs text-muted-foreground">{t.personalities[p.key].description}</span>
        </button>
      ))}
    </div>
  );
}
