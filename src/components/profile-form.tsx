"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ProfileForm({
  t,
  defaultName,
  defaultHandicap,
  defaultCoachTone,
  defaultLanguage,
}: {
  t: Dictionary["perfil"];
  defaultName: string;
  defaultHandicap: number | null;
  defaultCoachTone: string;
  defaultLanguage: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t.name}</Label>
        <Input id="name" name="name" defaultValue={defaultName} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="handicap">{t.handicap}</Label>
        <Input
          id="handicap"
          name="handicap"
          type="number"
          step="0.1"
          defaultValue={defaultHandicap ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="coachTone">{t.coachTone}</Label>
        <select
          id="coachTone"
          name="coachTone"
          defaultValue={defaultCoachTone}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="CERCANO">{t.toneCercano}</option>
          <option value="FORMAL">{t.toneFormal}</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="language">{t.language}</Label>
        <select
          id="language"
          name="language"
          defaultValue={defaultLanguage}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="es">{t.langEs}</option>
          <option value="en">{t.langEn}</option>
        </select>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}
