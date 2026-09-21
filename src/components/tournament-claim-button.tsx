"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { claimParticipant } from "@/actions/tournaments";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function TournamentClaimButton({
  participantId,
  t,
}: {
  participantId: string;
  t: Dictionary["tournaments"];
}) {
  const [claimed, setClaimed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function claim() {
    startTransition(async () => {
      try {
        await claimParticipant(participantId);
        setClaimed(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.claimError);
      }
    });
  }

  if (claimed) {
    return <span className="shrink-0 text-xs font-medium text-primary">{t.claimed}</span>;
  }

  return (
    <button
      type="button"
      onClick={claim}
      disabled={isPending}
      className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors active:bg-secondary/70 disabled:opacity-50"
    >
      {t.claimButton}
    </button>
  );
}
