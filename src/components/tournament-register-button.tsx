"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { registerForTournament, unregisterFromTournament } from "@/actions/tournaments";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function TournamentRegisterButton({
  tournamentId,
  initiallyRegistered,
  t,
}: {
  tournamentId: string;
  initiallyRegistered: boolean;
  t: Dictionary["tournaments"];
}) {
  const [registered, setRegistered] = useState(initiallyRegistered);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !registered;
    setRegistered(next);
    startTransition(async () => {
      try {
        if (next) await registerForTournament(tournamentId);
        else await unregisterFromTournament(tournamentId);
      } catch (err) {
        setRegistered(!next);
        toast.error(err instanceof Error ? err.message : t.registerError);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
        registered ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
      )}
    >
      {registered && <Check className="size-3.5" />}
      {registered ? t.registered : t.register}
    </button>
  );
}
