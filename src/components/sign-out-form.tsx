"use client";

import { Capacitor } from "@capacitor/core";
import { signOutAction } from "@/actions/profile";
import { logoutRevenueCat } from "@/lib/revenuecat-client";

/**
 * Fase 12C — mismo <form action={signOutAction}> de siempre, con un único
 * añadido: en nativo, cerrar sesión también cierra la identidad de
 * RevenueCat (Purchases.logOut()) ANTES de que la navegación del sign-out
 * se complete — best-effort, no bloquea el cierre de sesión si falla. Sin
 * esto, el siguiente usuario que inicie sesión en el mismo dispositivo
 * heredaría el CustomerInfo del anterior.
 */
export function SignOutForm({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <form
      action={signOutAction}
      className={className}
      onSubmit={() => {
        if (Capacitor.isNativePlatform()) logoutRevenueCat().catch(() => {});
      }}
    >
      {children}
    </form>
  );
}
