"use client";

import { useActionState } from "react";
import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  defaultName,
  defaultHandicap,
  defaultCoachTone,
  defaultLanguage,
}: {
  defaultName: string;
  defaultHandicap: number | null;
  defaultCoachTone: string;
  defaultLanguage: string;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={defaultName} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="handicap">Hándicap (opcional)</Label>
        <Input
          id="handicap"
          name="handicap"
          type="number"
          step="0.1"
          defaultValue={defaultHandicap ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="coachTone">Tono del coach</Label>
        <select
          id="coachTone"
          name="coachTone"
          defaultValue={defaultCoachTone}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="CERCANO">Cercano</option>
          <option value="FORMAL">Formal</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="language">Idioma</Label>
        <select
          id="language"
          name="language"
          defaultValue={defaultLanguage}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
