import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";
import { SignOutForm } from "@/components/sign-out-form";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { createCheckoutSession, createPortalSession, createVoicePackCheckoutSession } from "@/actions/stripe";
import { isProStatus, isStripeConfigured, isVoicePackConfigured } from "@/lib/stripe";
import { isAdminEmail, isOwnerEmail } from "@/lib/admin";
import { getVoiceCreditStatus } from "@/lib/voice/credits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";
import { isNativeAppRequest } from "@/lib/native-app";

/**
 * Ajustes = cuenta/preferencias, separado de /perfil (la ficha del
 * golfista). Perfil se ve, Ajustes se configura.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; voicePack?: string }>;
}) {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { subscriptions: true },
  });
  const { t } = await getDictionary();
  const { checkout, voicePack } = await searchParams;

  const owner = isOwnerEmail(user.email);
  const voiceCredits = await getVoiceCreditStatus(userId, user.plan);
  const minutesUsed = (voiceCredits.includedLimitSeconds - voiceCredits.includedRemainingSeconds) / 60;
  const minutesIncluded = voiceCredits.includedLimitSeconds / 60;
  const purchasedMinutesAvailable = Math.floor(voiceCredits.purchasedRemainingSeconds / 60);
  // Fase 12C: un usuario puede tener también una Subscription(REVENUECAT) —
  // esta pantalla solo gestiona la parte de Stripe (portal, upgrade web).
  const subscription = user.subscriptions.find((s) => s.provider === "STRIPE");
  const isTrialing = subscription?.status === "TRIALING";
  const isPastDue = subscription?.status === "PAST_DUE";
  const hasStoreSubscription = user.subscriptions.some(
    (s) => s.provider === "REVENUECAT" && isProStatus(s.status)
  );
  // Dentro de la app nativa nunca se muestra nada que lleve a pagar con
  // Stripe (App Store 3.1.1 / Google Play Billing): ni checkout, ni portal,
  // ni pack de Voice. Solo el estado del plan.
  const isNativeApp = await isNativeAppRequest();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <Link href="/perfil" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
          {t.perfil.backToProfile}
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t.perfil.settingsLabel}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </div>

      {checkout === "success" && (
        <p className="rounded-xl border border-primary/30 bg-secondary/40 p-3 text-sm">
          {t.perfil.checkoutSuccess}
        </p>
      )}
      {checkout === "cancel" && (
        <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          {t.perfil.checkoutCancelled}
        </p>
      )}
      {voicePack === "success" && (
        <p className="rounded-xl border border-primary/30 bg-secondary/40 p-3 text-sm">
          {t.perfil.voicePackSuccess}
        </p>
      )}
      {voicePack === "cancel" && (
        <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          {t.perfil.voicePackCancelled}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t.perfil.billingTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {owner ? t.perfil.ownerPlan : user.plan === "PRO" ? t.perfil.proPlan : t.perfil.freePlan}
            </span>
            <span className="text-xs text-muted-foreground">
              {owner
                ? t.perfil.ownerAccess
                : fmt(t.perfil.minutesUsed, { used: Math.round(minutesUsed), included: minutesIncluded })}
            </span>
          </div>

          {!owner && user.plan === "PRO" && purchasedMinutesAvailable > 0 && (
            <p className="text-xs text-muted-foreground">
              {fmt(t.perfil.purchasedMinutesAvailable, { minutes: purchasedMinutesAvailable })}
            </p>
          )}

          {!isNativeApp && !owner && user.plan === "PRO" && isVoicePackConfigured() && (
            <form action={createVoicePackCheckoutSession}>
              <Button type="submit" variant="outline" size="sm" className="w-full justify-center">
                {t.perfil.buyVoicePack}
              </Button>
            </form>
          )}

          {!owner && user.plan === "PRO" && subscription?.currentPeriodEnd && (
            <p className="text-xs text-muted-foreground">
              {isTrialing
                ? fmt(t.perfil.trialActive, {
                    date: subscription.currentPeriodEnd.toLocaleDateString(t.dateLocale, {
                      day: "numeric",
                      month: "long",
                    }),
                  })
                : subscription.cancelAtPeriodEnd
                  ? fmt(t.perfil.cancelAtPeriodEnd, {
                      date: subscription.currentPeriodEnd.toLocaleDateString(t.dateLocale, {
                        day: "numeric",
                        month: "long",
                      }),
                    })
                  : fmt(t.perfil.renewsOn, {
                      date: subscription.currentPeriodEnd.toLocaleDateString(t.dateLocale, {
                        day: "numeric",
                        month: "long",
                      }),
                    })}
            </p>
          )}

          {!owner && isPastDue && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              {t.perfil.pastDueWarning}
            </p>
          )}

          {owner || isNativeApp ? null : isStripeConfigured() ? (
            user.plan === "PRO" ? (
              <form action={createPortalSession}>
                <Button type="submit" variant="outline" size="sm">
                  {t.perfil.manageSubscription}
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-3 border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium text-primary">{t.landing.premiumTagline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.landing.premiumBody}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <form action={createCheckoutSession.bind(null, "MONTHLY")}>
                    <Button type="submit" size="sm" className="w-full justify-center">
                      {t.perfil.upgradeMonthly}
                    </Button>
                  </form>
                  <form action={createCheckoutSession.bind(null, "ANNUAL")}>
                    <Button type="submit" size="sm" variant="secondary" className="w-full justify-center">
                      {t.perfil.upgradeAnnual}
                      <span className="ml-1.5 text-[10px] font-semibold opacity-80">
                        {t.perfil.annualSavings}
                      </span>
                    </Button>
                  </form>
                  {!user.hasUsedTrial && (
                    <p className="text-center text-xs text-muted-foreground">{t.perfil.trialNote}</p>
                  )}
                </div>
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">{t.perfil.billingUnavailable}</p>
          )}
        </CardContent>
      </Card>

      <ProfileForm
        t={t.perfil}
        defaultName={user.name ?? ""}
        defaultHandicap={user.handicap}
        defaultClub={user.club}
        defaultLanguage={user.language}
      />

      <p className="text-xs text-muted-foreground">{t.perfil.disclaimer}</p>

      {isAdminEmail(user.email) && (
        <Link
          href="/admin/videos"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ShieldCheck className="size-4" />
          Admin
        </Link>
      )}

      <SignOutForm>
        <Button type="submit" variant="outline" className="w-full">
          {t.perfil.signOut}
        </Button>
      </SignOutForm>

      <DeleteAccountSection t={t.perfil} hasStoreSubscription={hasStoreSubscription} />
    </div>
  );
}
