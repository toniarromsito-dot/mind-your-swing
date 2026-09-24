import { mobileSignInWithApple, mobileSignInWithGoogle } from "@/actions/auth";
import { AutoSubmitForm } from "@/components/auto-submit-form";
import { isAppleSignInConfigured } from "@/lib/auth-providers";

/**
 * Se abre dentro de una Custom Tab (Browser.open desde /app-entry), NUNCA
 * dentro del WebView de la app — así todo el intercambio con Google o Apple
 * (cookies de state/PKCE incluidas) ocurre en un único sitio, sin el salto
 * WebView → navegador que rompe la verificación. El formulario se autoenvía
 * al cargar; el botón queda como respaldo si el navegador bloquea el
 * autoenvío. `?provider=apple` elige Apple; por defecto, Google.
 */
export default async function MobileLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider } = await searchParams;
  const useApple = provider === "apple" && isAppleSignInConfigured();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-primary px-6 text-center text-primary-foreground">
      <p className="font-heading text-2xl font-semibold">Mind Your Swing</p>
      <AutoSubmitForm action={useApple ? mobileSignInWithApple : mobileSignInWithGoogle}>
        <button
          type="submit"
          className="rounded-full bg-primary-foreground px-6 py-3 text-sm font-medium text-primary"
        >
          {useApple ? "Continuar con Apple" : "Continuar con Google"}
        </button>
      </AutoSubmitForm>
    </div>
  );
}
