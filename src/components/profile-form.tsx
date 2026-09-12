"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ProfileForm({
  t,
  defaultName,
  defaultHandicap,
  defaultLanguage,
}: {
  t: Dictionary["perfil"];
  defaultName: string;
  defaultHandicap: number | null;
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
        <Label htmlFor="language">{t.language}</Label>
        {/* Select propio (no el <select> nativo del sistema): en Safari/iOS,
            dentro de una PWA instalada en modo standalone, el picker nativo
            a veces no responde al tocarlo (bug conocido de WebKit). Este
            componente no depende de esa UI nativa. */}
        <Select
          name="language"
          defaultValue={defaultLanguage}
          items={{ es: t.langEs, en: t.langEn, de: t.langDe }}
        >
          <SelectTrigger id="language" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">{t.langEs}</SelectItem>
            <SelectItem value="en">{t.langEn}</SelectItem>
            <SelectItem value="de">{t.langDe}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}
