import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
import { LanguageToggle } from "@/components/language-toggle";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { locale, t } = await getDictionary();

  const pillars = [
    { title: t.landing.pillar1Title, body: t.landing.pillar1Body },
    { title: t.landing.pillar2Title, body: t.landing.pillar2Body },
    { title: t.landing.pillar3Title, body: t.landing.pillar3Body },
  ];

  return (
    <main className="flex-1">
      <div className="flex justify-end px-6 pt-6">
        <LanguageToggle locale={locale} label={t.landing.languageToggle} />
      </div>

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, var(--secondary) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-10 pb-16 text-center sm:pt-20">
          <span className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            {t.landing.badge}
          </span>
          <h1 className="font-heading text-4xl leading-tight text-balance sm:text-5xl">
            {t.landing.title}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            {t.landing.subtitle}
          </p>
          <form action={signInWithGoogle}>
            <Button
              type="submit"
              size="lg"
              className="h-12 gap-3 rounded-full px-6 text-base shadow-sm"
            >
              <GoogleIcon className="size-5" />
              {t.landing.signIn}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">{t.landing.disclaimer}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-3">
          {pillars.map((p) => (
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
