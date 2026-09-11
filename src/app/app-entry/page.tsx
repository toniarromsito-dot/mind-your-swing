import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/current-locale";
import { NativeLoginScreen } from "@/components/native-login-screen";

/**
 * Punto de entrada exclusivo de la app nativa (ver capacitor.config.ts,
 * server.url) — la web pública sigue viviendo en "/", intacta. Si ya hay
 * sesión (el WebView guarda su propia cookie entre aperturas de la app),
 * va directa al dashboard sin pasar por login.
 */
export default async function AppEntryPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { t } = await getDictionary();
  return <NativeLoginScreen signInLabel={t.landing.signIn} />;
}
