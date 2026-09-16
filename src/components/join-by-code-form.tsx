"use client";

import { useActionState } from "react";
import { goToJoinByCode, type ActionState } from "@/actions/games";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function JoinByCodeForm({ t }: { t: Dictionary["joinGame"] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    goToJoinByCode,
    undefined
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-3xl bg-card/95 p-5 shadow-lg backdrop-blur-sm"
    >
      <input
        name="code"
        placeholder={t.codePlaceholder}
        autoCapitalize="characters"
        autoComplete="off"
        className="rounded-full border border-input bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state?.error && <p className="px-1 text-xs text-destructive">{t.missingCode}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {t.submit}
      </button>
    </form>
  );
}
