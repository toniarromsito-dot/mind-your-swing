import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/current-locale";
import { NativeOnboarding } from "@/components/native-onboarding";

/**
 * Punto de entrada de "abrir la app" — de la app nativa (ver
 * capacitor.config.ts, server.url) y también del start_url de la PWA (ver
 * manifest.ts): la web pública de marketing sigue viviendo en "/", intacta.
 * Si ya hay sesión, va directa al dashboard sin pasar por login. Si no, el
 * onboarding decide él mismo (localStorage) si mostrar el carrusel o ir
 * directo al CTA — y ese CTA usa Google normal (formulario) en la PWA/web,
 * o la Custom Tab + deep link cuando corre dentro del WebView nativo (ver
 * NativeOnboarding).
 */
export default async function AppEntryPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { t } = await getDictionary();
  return <NativeOnboarding t={t.onboarding} />;
}
