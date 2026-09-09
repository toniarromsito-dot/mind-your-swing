"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitManualFeedback } from "@/actions/swing-videos";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function AdminFeedbackForm({
  videoId,
  existingFeedback,
  t,
}: {
  videoId: string;
  existingFeedback: string | null;
  t: Dictionary["admin"];
}) {
  const [text, setText] = useState(existingFeedback ?? "");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      const result = await submitManualFeedback(videoId, text);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSavedMsg(t.saved);
      }
    } catch {
      setError(t.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.feedbackPlaceholder}
        rows={3}
        disabled={saving}
      />
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" disabled={saving || !text.trim()} onClick={save} className="gap-2 self-start">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {saving ? t.saving : t.save}
        </Button>
        {savedMsg && <span className="text-xs text-muted-foreground">{savedMsg}</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}
