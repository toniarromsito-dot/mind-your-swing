import { redirect } from "next/navigation";
import { BookOpen, Flag, Hand, Mountain, Play, Target, Waves, MessageCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { signInWithGoogle } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
import { LanguageToggle } from "@/components/language-toggle";
import { LandingMobileNav } from "@/components/landing-mobile-nav";
import { LogoMark } from "@/components/logo-mark";
import { HeroIllustration } from "@/components/hero-illustration";
import {
  HomeMockup,
  LobbyMockup,
  ScorecardMockup,
  MindAnalysisMockup,
  ResultMockup,
  RivalryCard,
} from "@/components/landing-mockups";
import { getDictionary } from "@/lib/i18n/current-locale";

const BEGINNER_ICONS = [Hand, Waves, Target, Mountain, BookOpen, Flag];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { locale, t } = await getDictionary();
  const l = t.landing;
  const modeLabels = t.newGame.modeLabels;

  const steps = [
    { number: "01", title: l.step1Title, body: l.step1Body, mockup: <LobbyMockup /> },
    { number: "02", title: l.step2Title, body: l.step2Body, mockup: <ScorecardMockup holeNumber={8} /> },
    { number: "03", title: l.step3Title, body: l.step3Body, mockup: <MindAnalysisMockup /> },
  ];

  const friendGroups = [
    { label: l.friends2p, modes: [modeLabels.STROKE_PLAY, modeLabels.MATCH_PLAY, modeLabels.DUEL] },
    { label: l.friends3p, modes: [modeLabels.STROKE_PLAY, modeLabels.EVERYONE_VS_EVERYONE, modeLabels.POINTS] },
    { label: l.friends4p, modes: [modeLabels.STROKE_PLAY, modeLabels.TWO_VS_TWO, modeLabels.BEST_BALL, modeLabels.SCRAMBLE] },
  ];

  const navLinks = [
    { href: "#top", label: l.navProduct },
    { href: "#como-funciona", label: l.navHowItWorks },
    { href: "#precios", label: l.navPricing },
    { href: "#comunidad", label: l.navCommunity },
  ];

  return (
    <main id="top" className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden text-neutral-50" style={{ backgroundColor: "oklch(0.16 0.018 155)" }}>
        <HeroIllustration />

        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
          <a href="#top" className="flex shrink-0 items-center gap-2">
            <LogoMark className="h-5 w-auto text-white" />
            <span className="font-heading text-sm font-semibold tracking-tight whitespace-nowrap">Mind Your Swing</span>
          </a>
          <div className="hidden items-center gap-6 text-sm whitespace-nowrap text-neutral-300 lg:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageToggle locale={locale} label={l.languageToggle} />
            <form action={signInWithGoogle} className="hidden lg:block">
              <button type="submit" className="text-sm whitespace-nowrap text-neutral-300 transition-colors hover:text-white">
                {l.navSignIn}
              </button>
            </form>
            <form action={signInWithGoogle}>
              <Button
                type="submit"
                size="sm"
                className="rounded-full bg-white px-4 text-xs font-semibold tracking-wide whitespace-nowrap text-neutral-900 uppercase hover:bg-neutral-200"
              >
                {l.ctaPrimary}
              </Button>
            </form>
            <LandingMobileNav links={navLinks} signInLabel={l.navSignIn} ctaLabel={l.ctaPrimary} onSignIn={signInWithGoogle} />
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-14 pb-20 sm:grid-cols-2 sm:items-center sm:pt-20 sm:pb-28">
          <div>
            <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "oklch(0.72 0.09 155)" }}>
              {l.heroKicker}
            </p>
            <h1 className="mt-3 font-heading text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              {l.heroLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="mt-5 max-w-md text-lg text-neutral-300">{l.heroDescription}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <form action={signInWithGoogle}>
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 gap-3 rounded-full bg-white px-6 text-sm font-semibold tracking-wide text-neutral-900 uppercase hover:bg-neutral-200"
                >
                  <GoogleIcon className="size-5" />
                  {l.ctaPrimary}
                </Button>
              </form>
              <a
                href="#como-funciona"
                className="flex h-12 items-center gap-2.5 rounded-full border border-neutral-700 px-6 text-sm font-semibold tracking-wide text-neutral-100 uppercase transition-colors hover:border-neutral-500"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-white/10">
                  <Play className="size-3 fill-current" />
                </span>
                {l.ctaSecondary}
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              {[l.heroBadge1, l.heroBadge2, l.heroBadge3].map((badge) => (
                <span key={badge} className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400">
                  {badge}
                </span>
              ))}
            </div>

            <p className="mt-8 max-w-md text-xs text-neutral-500">{l.disclaimer}</p>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="hidden -mr-12 rotate-[-6deg] opacity-90 sm:block">
              <HomeMockup />
            </div>
            <div className="relative z-10 scale-100 sm:scale-110">
              <ScorecardMockup />
            </div>
            <div className="hidden -ml-12 rotate-[6deg] opacity-90 sm:block">
              <ResultMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Filosofía: antes / durante / después */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-center sm:grid-cols-3 sm:gap-4">
          {[
            { label: l.philosophyBeforeLabel, body: l.philosophyBeforeBody },
            { label: l.philosophyDuringLabel, body: l.philosophyDuringBody },
            { label: l.philosophyAfterLabel, body: l.philosophyAfterBody },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs font-medium tracking-wide text-primary uppercase">{item.label}</p>
              <p className="mt-1 font-heading text-xl font-semibold">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona: preparar, jugar, aprender */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="grid gap-16 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center gap-6 text-center">
              <div>
                <span className="font-heading text-sm text-muted-foreground">{step.number}</span>
                <h3 className="mt-1 font-heading text-2xl font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{step.body}</p>
              </div>
              {step.mockup}
            </div>
          ))}
        </div>
      </section>

      {/* Jugar con amigos */}
      <section className="bg-secondary/40 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.friendsTitle}</h2>
            <p className="mt-3 text-muted-foreground">{l.friendsBody}</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {friendGroups.map((group) => (
              <div key={group.label} className="rounded-2xl border border-border bg-card p-6">
                <p className="font-heading text-lg font-semibold">{group.label}</p>
                <ul className="mt-4 flex flex-col gap-2">
                  {group.modes.map((mode) => (
                    <li key={mode} className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">
                      {mode}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm font-medium text-primary">{l.friendsFreeNote}</p>
        </div>
      </section>

      {/* Focus mode */}
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-20 sm:grid-cols-2 sm:py-28">
        <div className="order-2 sm:order-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">{l.focusEyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.focusTitle}</h2>
          <p className="mt-4 max-w-md text-muted-foreground">{l.focusBody}</p>
        </div>
        <div className="order-1 sm:order-2">
          <ScorecardMockup holeNumber={11} />
        </div>
      </section>

      {/* Mentoría post-vuelta + revancha */}
      <section className="bg-secondary/40 px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 sm:grid-cols-2">
          <MindAnalysisMockup />
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{l.mentorEyebrow}</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.mentorTitle}</h2>
            <p className="mt-4 max-w-md text-muted-foreground">{l.mentorBody}</p>

            <div className="mt-8 border-t border-border pt-8">
              <h3 className="font-heading text-xl font-semibold">{l.revengeTitle}</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">{l.revengeBody}</p>
              <div className="mt-5">
                <RivalryCard />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Aprende a jugar */}
      <section id="aprende" className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.beginnerTitle}</h2>
          <p className="mt-3 text-muted-foreground">{l.beginnerBody}</p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {l.beginnerTopics.map((topic, i) => {
            const Icon = BEGINNER_ICONS[i % BEGINNER_ICONS.length];
            const isPremium = i >= l.beginnerTopics.length - 2;
            return (
              <div key={topic} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <Icon className="size-5 text-primary" />
                <p className="text-sm font-medium">{topic}</p>
                <span
                  className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isPremium ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {isPremium ? l.beginnerPremiumTag : l.beginnerFreeTag}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comunidad */}
      <section id="comunidad" className="bg-secondary/40 px-6 py-20 sm:py-28">
        <div className="mx-auto grid max-w-4xl items-center gap-10 sm:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{l.communityTitle}</h2>
            <p className="mt-3 max-w-sm text-muted-foreground">{l.communityBody}</p>
            <a href="#top" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-4">
              {l.communityCta}
            </a>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-medium">{l.communityExampleQuestion}</p>
            <div className="mt-3 flex h-28 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <MessageCircle className="size-6" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{l.communityExampleReplies}</p>
          </div>
        </div>
      </section>

      {/* Premium */}
      <section id="precios" className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <div className="rounded-3xl border border-primary/25 bg-secondary/40 p-8 text-center">
          <h2 className="font-heading text-2xl font-semibold">{l.premiumTitle}</h2>
          <p className="mt-1 text-sm font-medium text-primary">{l.premiumTagline}</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{l.premiumBody}</p>
          <p className="mt-4 font-heading text-3xl font-semibold">{l.premiumPrice}</p>
          <form action={signInWithGoogle} className="mt-5 inline-block">
            <Button type="submit" size="lg" className="rounded-full px-6">
              {l.premiumCta}
            </Button>
          </form>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 py-20 text-center text-neutral-50" style={{ backgroundColor: "oklch(0.16 0.018 155)" }}>
        <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{l.finalCtaTitle}</h2>
        <p className="mt-2 text-sm text-neutral-400">{l.finalCtaBody}</p>
        <form action={signInWithGoogle} className="mt-6 inline-block">
          <Button
            type="submit"
            size="lg"
            className="h-12 gap-3 rounded-full bg-white px-6 text-sm font-semibold tracking-wide text-neutral-900 uppercase hover:bg-neutral-200"
          >
            <GoogleIcon className="size-5" />
            {l.finalCtaButton}
          </Button>
        </form>
      </section>
    </main>
  );
}
