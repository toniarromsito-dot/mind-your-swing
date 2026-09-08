import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";

const PILLARS = [
  {
    title: "Antes de salir",
    body: "Un check-in breve de cómo llegas y una rutina corta de respiración o visualización para arrancar centrado.",
  },
  {
    title: "Durante la ronda",
    body: "Abre el chat en 1-2 toques sin perder el contexto del hoyo: sabe dónde estás, cómo vas y cómo te has sentido.",
  },
  {
    title: "Después de cada hoyo",
    body: "Un pequeño check-in de ánimo, opcional, para no perder el hilo de cómo evoluciona tu cabeza en la ronda.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, var(--secondary) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-20 pb-16 text-center sm:pt-28">
          <span className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            Tu cabeza también juega al golf
          </span>
          <h1 className="font-heading text-4xl leading-tight text-balance sm:text-5xl">
            Mind Your Swing
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            Un compañero mental de golf, impulsado por IA, que te acompaña antes y
            durante la ronda: control de nervios, gestión de la frustración y
            rutinas de enfoque, un golpe a la vez.
          </p>
          <form action={signInWithGoogle}>
            <Button
              type="submit"
              size="lg"
              className="h-12 gap-3 rounded-full px-6 text-base shadow-sm"
            >
              <GoogleIcon className="size-5" />
              Iniciar sesión con Google
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            No sustituye la terapia psicológica profesional. Es un compañero para
            el componente mental del juego.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-sm"
            >
              <h2 className="font-heading text-xl">{p.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
