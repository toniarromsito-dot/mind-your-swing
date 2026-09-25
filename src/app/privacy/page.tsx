import Link from "next/link";

/**
 * Fase 12E — infraestructura de la página, NO contenido legal real. Cada
 * sección está marcada explícitamente como borrador; el texto final lo
 * redacta quien corresponda (legal/producto) antes de publicar en las
 * stores, que exigen una Privacy Policy URL pública y accesible sin login.
 * Deliberadamente fuera de (app): sin sesión, sin nav de la app, servida
 * como HTML simple (sin JS de cliente más allá de lo que Next añade por
 * defecto).
 */
const SECTIONS = [
  "Qué datos recogemos",
  "Cómo usamos los datos",
  "Con quién los compartimos (proveedores: Google, Stripe, RevenueCat, Anthropic, ElevenLabs)",
  "Conservación de datos",
  "Tus derechos (acceso, rectificación, supresión)",
  "Menores de edad",
  "Cambios en esta política",
  "Contacto",
];

export const metadata = {
  title: "Privacidad — Mind Your Swing",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Mind Your Swing
        </Link>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          Política de privacidad
        </h1>
        <p className="mt-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          Borrador de estructura — el contenido definitivo de cada sección
          está pendiente de redacción legal. Este texto no debe considerarse
          la política de privacidad final.
        </p>
      </div>

      <ol className="flex flex-col gap-6">
        {SECTIONS.map((title, i) => (
          <li key={title} className="flex flex-col gap-1.5 border-b border-border pb-6 last:border-b-0">
            <h2 className="font-heading text-lg font-medium">
              {i + 1}. {title}
            </h2>
            <p className="text-sm text-muted-foreground">Contenido pendiente.</p>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        Última actualización: pendiente de publicación.
      </p>
    </main>
  );
}
