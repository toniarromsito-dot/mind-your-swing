import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Paywall contextual — se muestra cuando el usuario intenta usar algo Pro,
 * no de entrada. Copy fija por diseño (ver brief): "MIND YOUR SWING PRO" /
 * precio plano / una sola CTA, nada de presión agresiva.
 */
export function ProUpsell({ t, isNativeApp = false }: { t: Dictionary["landing"]; isNativeApp?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-primary/30 bg-secondary/40 p-8 text-center">
      <Sparkles className="size-6 text-primary" />
      <h2 className="font-heading text-xl">{t.premiumTitle}</h2>
      <p className="max-w-xs text-sm text-muted-foreground">{t.premiumBody}</p>
      {/* Dentro de la app nativa no hay compra con Stripe (App Store 3.1.1 /
          Google Play Billing): ni precio ni CTA que lleve a pagar. */}
      {!isNativeApp && (
        <>
          <p className="font-heading text-2xl">{t.premiumPrice}</p>
          <Link href="/perfil" className={buttonVariants({ size: "lg", className: "mt-1 rounded-full px-6" })}>
            {t.premiumCta}
          </Link>
        </>
      )}
    </div>
  );
}
