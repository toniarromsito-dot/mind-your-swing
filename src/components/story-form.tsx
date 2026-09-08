"use client";

import { useActionState, useRef, useEffect } from "react";
import { createStory } from "@/actions/stories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function StoryForm({ t }: { t: Dictionary["stories"] }) {
  const [state, formAction, pending] = useActionState(createStory, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending && !state?.error) {
      formRef.current?.reset();
    }
    prevPending.current = pending;
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <h2 className="font-heading text-lg">{t.shareTitle}</h2>
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
