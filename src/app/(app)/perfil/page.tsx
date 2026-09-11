import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile-form";
import { signOutAction } from "@/actions/profile";
import { createCheckoutSession, createPortalSession } from "@/actions/stripe";
import { isStripeConfigured } from "@/lib/stripe";
import { isAdminEmail, isOwnerEmail } from "@/lib/admin";
import { getVoiceMinutesUsedThisPeriod, INCLUDED_VOICE_MINUTES } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const { t } = await getDictionary();
  const { checkout } = await searchParams;

  const owner = isOwnerEmail(user.email);
  const minutesUsed = await getVoiceMinutesUsedThisPeriod(userId);
  const minutesIncluded = INCLUDED_VOICE_MINUTES[user.plan];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center gap-4">
        {user.image && (
          <Image src={user.image} alt={user.name ?? ""} width={56} height={56} className="rounded-full" />
        )}
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
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

          {owner ? null : isStripeConfigured() ? (
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
                <form action={createCheckoutSession} className="flex flex-col items-start gap-1.5">
                  <Button type="submit" size="sm">
                    {t.perfil.upgrade}
                  </Button>
                  <span className="text-xs text-muted-foreground">{t.perfil.proPrice}</span>
                </form>
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

      <form action={signOutAction} className="lg:hidden">
        <Button type="submit" variant="outline" className="w-full">
          {t.perfil.signOut}
        </Button>
      </form>
    </div>
  );
}
