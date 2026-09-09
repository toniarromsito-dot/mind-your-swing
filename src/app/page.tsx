import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
import { LanguageToggle } from "@/components/language-toggle";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { locale, t } = await getDictionary();
  const l = t.landing;

  const sections = [
    { emoji: "🧠", title: l.companionTitle, body: l.companionBody },
    { emoji: "🏌️", title: l.playTitle, body: l.playBody },
    { emoji: "🎯", title: l.mindTitle, body: l.mindBody },
    { emoji: "⛳", title: l.learnTitle, body: l.learnBody },
    { emoji: "🌱", title: l.academyTitle, body: l.academyBody },
    { emoji: "👥", title: l.communityTitle, body: l.communityBody },
  ];

  return (
    <main className="flex-1">
      <div className="flex justify-end px-6 pt-6">
        <LanguageToggle locale={locale} label={l.languageToggle} />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: "radial-gradient(60% 50% at 50% 0%, var(--secondary) 0%, transparent 70%)",
          }}
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-10 pb-16 text-center sm:pt-20">
          <Image src="/icons/icon-192.png" alt="Mind Your Swing" width={56} height={56} className="rounded-2xl shadow-sm" />
          <h1 className="font-heading text-4xl leading-tight tracking-tight text-balance sm:text-5xl">{l.heroTitle}</h1>
          <p className="font-heading text-xl text-primary">{l.heroTagline}</p>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">{l.heroSubtitle}</p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <form action={signInWithGoogle}>
              <Button type="submit" size="lg" className="h-12 gap-3 rounded-full px-6 text-base shadow-sm">
                <GoogleIcon className="size-5" />
                {l.ctaPrimary}
              </Button>
            </form>
            <a href="#como-funciona" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 rounded-full px-6 text-base" })}>
              {l.ctaSecondary}
            </a>
          </div>

          <p className="text-xs text-muted-foreground">{l.disclaimer}</p>
        </div>
      </section>

      {/* Secciones del producto */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <div key={s.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <span className="text-2xl">{s.emoji}</span>
              <h2 className="mt-3 font-heading text-xl">{s.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Premium */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-3xl border border-primary/30 bg-secondary/40 p-8 text-center">
          <h2 className="font-heading text-2xl">{l.premiumTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{l.premiumBody}</p>
          <p className="mt-4 font-heading text-3xl">{l.premiumPrice}</p>
          <form action={signInWithGoogle} className="mt-5 inline-block">
            <Button type="submit" size="lg" className="rounded-full px-6">
              {l.premiumCta}
            </Button>
          </form>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="text-center font-heading text-2xl">{l.howItWorksTitle}</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {l.howItWorksSteps.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {i + 1}
              </span>
              <p className="font-medium">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-2xl px-6 pb-24 text-center">
        <h2 className="font-heading text-2xl">{l.finalCtaTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{l.finalCtaBody}</p>
        <form action={signInWithGoogle} className="mt-5 inline-block">
          <Button type="submit" size="lg" className="h-12 gap-3 rounded-full px-6 text-base shadow-sm">
            <GoogleIcon className="size-5" />
            {l.finalCtaButton}
          </Button>
        </form>
      </section>
    </main>
  );
}
