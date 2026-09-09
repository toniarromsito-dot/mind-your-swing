import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
import { LanguageToggle } from "@/components/language-toggle";
import { ScorecardMockup, MindChatMockup, ResultMockup } from "@/components/landing-mockups";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { locale, t } = await getDictionary();
  const l = t.landing;

  return (
    <main className="flex-1">
      <div className="flex justify-end px-6 pt-6">
        <LanguageToggle locale={locale} label={l.languageToggle} />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            maskImage: "radial-gradient(65% 60% at 50% 15%, black 0%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(65% 60% at 50% 15%, black 0%, transparent 75%)",
          }}
        >
          <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMin slice" className="h-full w-full" fill="none">
            {/* Curvas de nivel de un green, como en una libreta de distancias — un guiño sutil al golf sin caer en el césped/cliché. */}
            <g stroke="var(--foreground)" strokeWidth="1.1" opacity="0.14">
              <path d="M100,180 C150,80 400,40 550,90 C700,130 720,260 620,320 C520,380 300,400 180,340 C90,300 60,250 100,180 Z" />
              <path d="M150,190 C190,110 380,80 500,115 C630,150 645,250 565,295 C480,345 320,360 225,315 C155,285 130,245 150,190 Z" />
              <path d="M200,200 C230,140 370,120 460,145 C555,170 565,240 505,270 C445,305 335,315 265,285 C215,262 195,235 200,200 Z" />
              <path d="M260,210 C280,175 355,165 410,182 C465,200 470,235 435,255 C400,275 330,280 290,262 C265,250 252,230 260,210 Z" />
            </g>
            <g stroke="var(--primary)" opacity="0.4">
              <line x1="344" y1="150" x2="344" y2="225" strokeWidth="2" />
              <path d="M344,150 L344,172 L372,161 Z" fill="var(--primary)" stroke="none" />
            </g>
          </svg>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-10 pb-16 text-center sm:pt-20">
          <Image src="/icons/icon-192.png" alt="Mind Your Swing" width={56} height={56} className="rounded-2xl shadow-sm" />
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{l.heroTitle}</h1>
          <p className="font-heading text-xl text-primary">{l.heroTagline}</p>
          <p className="text-lg font-medium text-muted-foreground">{l.heroSubtitle}</p>

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

          <div className="mt-6 grid w-full gap-6 sm:grid-cols-3">
            <ScorecardMockup />
            <MindChatMockup />
            <ResultMockup />
          </div>
        </div>
      </section>

      {/* El viaje real: antes / durante / después */}
      <section className="mx-auto flex max-w-5xl flex-col gap-24 px-6 py-20">
        <div className="grid items-center gap-10 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">{l.journeyEyebrow}</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.beforeTitle}</h2>
            <p className="mt-4 max-w-md text-muted-foreground">{l.beforeBody}</p>
          </div>
        </div>

        <div className="grid items-center gap-10 sm:grid-cols-2">
          <div className="order-2 sm:order-1">
            <ScorecardMockup />
          </div>
          <div className="order-1 sm:order-2">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">{l.duringEyebrow}</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.duringTitle}</h2>
            <p className="mt-4 max-w-md text-lg text-muted-foreground">{l.duringSubtitle}</p>
          </div>
        </div>

        <div className="grid items-center gap-10 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium tracking-wide text-primary uppercase">{l.afterEyebrow}</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.afterTitle}</h2>
            <p className="mt-4 max-w-md text-muted-foreground">{l.afterBody}</p>
            <p className="mt-4 max-w-md font-medium text-primary">&ldquo;{l.afterExample}&rdquo;</p>
          </div>
          <MindChatMockup />
        </div>
      </section>

      <p className="mx-auto max-w-2xl px-6 pb-16 text-center text-sm text-muted-foreground">{l.secondaryLine}</p>

      {/* Premium */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-3xl border border-primary/30 bg-secondary/40 p-8 text-center">
          <h2 className="font-heading text-2xl font-semibold">{l.premiumTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{l.premiumBody}</p>
          <p className="mt-4 font-heading text-3xl font-semibold">{l.premiumPrice}</p>
          <form action={signInWithGoogle} className="mt-5 inline-block">
            <Button type="submit" size="lg" className="rounded-full px-6">
              {l.premiumCta}
            </Button>
          </form>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="mx-auto max-w-4xl px-6 pb-20">
        <h2 className="text-center font-heading text-2xl font-semibold">{l.howItWorksTitle}</h2>
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
        <h2 className="font-heading text-2xl font-semibold">{l.finalCtaTitle}</h2>
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
