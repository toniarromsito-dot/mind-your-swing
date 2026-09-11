import { mobileSignInWithGoogle } from "@/actions/auth";
import { AutoSubmitForm } from "@/components/auto-submit-form";

/**
 * Se abre dentro de una Custom Tab (Browser.open desde /app-entry), NUNCA
 * dentro del WebView de la app — así todo el intercambio con Google
 * (cookies de state/PKCE incluidas) ocurre en un único sitio, sin el salto
 * WebView → Chrome que rompe la verificación. El formulario se autoenvía
 * al cargar; el botón queda como respaldo si el navegador bloquea el
 * autoenvío.
 */
export default function MobileLoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-primary px-6 text-center text-primary-foreground">
      <p className="font-heading text-2xl font-semibold">Mind Your Swing</p>
      <AutoSubmitForm action={mobileSignInWithGoogle}>
        <button
          type="submit"
          className="rounded-full bg-primary-foreground px-6 py-3 text-sm font-medium text-primary"
        >
          Continuar con Google
        </button>
      </AutoSubmitForm>
    </div>
  );
}
