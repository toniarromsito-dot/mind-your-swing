"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createStory } from "@/actions/stories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Category = "GENERAL" | "CAMPO" | "CONSEJO";
const CATEGORIES: Category[] = ["GENERAL", "CAMPO", "CONSEJO"];

export function StoryForm({ t, onPosted }: { t: Dictionary["community"]; onPosted?: () => void }) {
  const [state, formAction, pending] = useActionState(createStory, undefined);
  const [category, setCategory] = useState<Category>("GENERAL");
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);

  const categoryLabel: Record<Category, string> = {
    GENERAL: t.categoryGeneral,
    CAMPO: t.categoryCampo,
    CONSEJO: t.categoryConsejo,
  };

  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setCategory("GENERAL");
      onPosted?.();
    }
    prevPending.current = pending;
  }, [pending, state, onPosted]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="category" value={category} />
      <h2 className="font-heading text-lg">{t.shareTitle}</h2>
      <div className="flex flex-col gap-2">
        <Label>{t.categoryLabel}</Label>
        <div className="flex gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-secondary/60"
              )}
            >
              {categoryLabel[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="story-title">{t.titleLabel}</Label>
        <Input id="story-title" name="title" placeholder={t.titlePlaceholder} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="story-content">{t.contentLabel}</Label>
        <Textarea id="story-content" name="content" placeholder={t.contentPlaceholder} rows={4} required />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
