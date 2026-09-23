import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseFeature } from "@/lib/entitlements";
import { AppShell } from "@/components/app-shell";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { t } = await getDictionary();

  // Fase 11F — AD_FREE se relee siempre de Prisma (nunca de session.user,
  // que no lleva plan/email) y se calcula server-side, igual que cualquier
  // otro gate Pro de la app — el cliente (AdBanner) solo obedece este valor,
  // nunca lo decide.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { plan: true, email: true },
  });
  const adFree = canUseFeature(user, "AD_FREE");

  return (
    <AppShell user={session.user} t={t.nav} adFree={adFree}>
      {children}
    </AppShell>
  );
}
