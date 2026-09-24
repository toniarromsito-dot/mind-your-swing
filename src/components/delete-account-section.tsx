"use client";

import { useActionState, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { deleteAccount } from "@/actions/account";
import { logoutRevenueCat } from "@/lib/revenuecat-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Borrado de cuenta (App Store 5.1.1(v)). Dos pasos a propósito: primero se
 * despliega el aviso, luego hay que escribir la palabra de confirmación —
 * nunca se borra nada con un solo toque.
 */
export function DeleteAccountSection({
  t,
  hasStoreSubscription,
}: {
  t: Dictionary["perfil"];
  /** Suscripción activa de App Store / Google Play: el servidor no puede cancelarla, hay que avisar. */
  hasStoreSubscription: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, undefined);

  useEffect(() => {
    if (!state?.deleted) return;
    const isNative = Capacitor.isNativePlatform();
    (async () => {
      if (isNative) await logoutRevenueCat().catch(() => {});
      window.location.href = isNative ? "/app-entry" : "/";
    })();
  }, [state?.deleted]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-center text-sm text-destructive underline-offset-4 hover:underline"
      >
        {t.deleteAccount}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">{t.deleteAccountTitle}</p>
      <p className="text-xs text-muted-foreground">{t.deleteAccountBody}</p>
      {hasStoreSubscription && <p className="text-xs font-medium">{t.deleteAccountStoreNote}</p>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-confirm" className="text-xs">
          {fmt(t.deleteAccountConfirmLabel, { word: t.deleteAccountConfirmWord })}
        </Label>
        <Input id="delete-confirm" name="confirm" autoComplete="off" autoCapitalize="characters" required />
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
          {t.deleteAccountCancel}
        </Button>
        <Button type="submit" variant="destructive" size="sm" className="flex-1" disabled={pending || state?.deleted}>
          {pending || state?.deleted ? t.deleteAccountDeleting : t.deleteAccountSubmit}
        </Button>
      </div>
    </form>
  );
}
