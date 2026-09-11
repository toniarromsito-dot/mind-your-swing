import { redirect } from "next/navigation";
import { createMobileHandoff } from "@/actions/auth";
import { AutoOpenApp } from "@/components/auto-open-app";

/**
 * Última parada del login nativo, dentro de la misma Custom Tab que hizo
 * todo el intercambio con Google (ver /mobile-login) — ya autenticada.
 * Solo hace de puente: mintea un token de un solo uso y lo pasa a la app
 * instalada vía deep link, para que /api/mobile/session pueda fijar la
 * misma sesión dentro del WebView.
 */
export default async function MobileBridgePage() {
  const token = await createMobileHandoff();
  if (!token) redirect("/mobile-login");

  const deepLink = `mindyourswing://auth-callback?token=${token}`;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      <AutoOpenApp url={deepLink} />
      <p className="font-heading text-lg font-semibold">Sesión iniciada</p>
      <p className="text-sm text-muted-foreground">Volviendo a Mind Your Swing…</p>
      <a href={deepLink} className="mt-2 text-sm text-primary underline">
        Si no vuelve sola, toca aquí
      </a>
    </div>
  );
}
