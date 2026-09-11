import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/current-locale";
import { NativeOnboarding } from "@/components/native-onboarding";

/**
 * Punto de entrada exclusivo de la app nativa (ver capacitor.config.ts,
 * server.url) — la web pública sigue viviendo en "/", intacta. Si ya hay
 * sesión (el WebView guarda su propia cookie entre aperturas de la app),
 * va directa al dashboard sin pasar por login. Si no, el onboarding decide
 * él mismo (localStorage) si mostrar el carrusel o ir directo al CTA.
 */
export default async function AppEntryPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { t } = await getDictionary();
  return <NativeOnboarding t={t.onboarding} />;
}
