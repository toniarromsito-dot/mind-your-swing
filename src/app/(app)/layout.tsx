import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { AppShell } from "@/components/app-shell";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { t } = await getDictionary();

  return (
    <AppShell user={session.user} t={t.nav} isAdmin={isAdminEmail(session.user.email)}>
      {children}
    </AppShell>
  );
}
