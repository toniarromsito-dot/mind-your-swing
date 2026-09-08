"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteStory } from "@/actions/stories";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function StoryDeleteButton({ storyId, t }: { storyId: string; t: Dictionary["stories"] }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteStory(storyId);
        toast.success(t.deleted);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.deleteError);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="size-3.5" />
      {t.delete}
    </button>
  );
}
