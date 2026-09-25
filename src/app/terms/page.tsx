import Link from "next/link";

/**
 * Fase 12E — infraestructura de la página, NO contenido legal real (ver
 * privacy/page.tsx, hermana de esta ruta, para el mismo criterio).
 */
const SECTIONS = [
  "Aceptación de los términos",
  "Descripción del servicio",
  "Cuentas y elegibilidad",
  "Suscripción PRO — facturación, renovación y cancelación (web vía Stripe, iOS/Android vía App Store/Google Play)",
  "Uso aceptable",
  "Propiedad intelectual",
  "Limitación de responsabilidad (avisos médicos/deportivos: no sustituye asesoramiento profesional)",
  "Terminación",
  "Ley aplicable",
  "Contacto",
];

export const metadata = {
  title: "Términos de uso — Mind Your Swing",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Mind Your Swing
        </Link>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">
          Términos de uso
        </h1>
        <p className="mt-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          Borrador de estructura — el contenido definitivo de cada sección
          está pendiente de redacción legal. Este texto no debe considerarse
          los términos de uso finales.
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
