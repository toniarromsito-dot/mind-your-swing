import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getActiveGamesForUser, getUserGolfSummary } from "@/lib/data/games";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
import { Flag, Brain, Target, Sprout, ArrowRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";

export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;

  const [user, activeGames, summary] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { handicap: true, mindMemory: true, plan: true } }),
    getActiveGamesForUser(userId),
    getUserGolfSummary(userId),
  ]);
  const activeGame = activeGames[0] ?? null;
  const isNewUser = summary.completedCount === 0 && !activeGame;
  const hasMemory = user.plan === "PRO" && Boolean(user.mindMemory);

  const secondaryCards = [
    { href: "/coach/videos", icon: Target, title: h.trainCard, body: h.trainCardBody },
    { href: "/coach", icon: Sprout, title: h.learnCard, body: h.learnCardBody },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.dashboard.greeting(session?.user.name?.split(" ")[0] ?? "")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{isNewUser ? h.welcomeNewTitle : h.welcomeReturningTitle}</p>
      </div>

      {activeGame && (
        <Card className="border-primary/30 bg-secondary/40">
          <CardContent className="flex items-center justify-between gap-4 py-5">
            <div>
              <p className="text-xs font-medium tracking-wide text-primary uppercase">{h.gameInProgress}</p>
              <p className="mt-1 font-heading text-lg font-semibold">{activeGame.course}</p>
              <p className="text-sm text-muted-foreground">
                {activeGame.players.length > 1 ? `${activeGame.players.length} ${t.play.players} · ` : ""}
                {t.newGame.modeLabels[activeGame.mode]}
              </p>
              {(() => {
                const { players, scores } = toStandingsInput(activeGame);
                const standings = computeStrokeStandings(players, scores);
                const me = standings.find(
                  (s) => activeGame.players.find((p) => p.id === s.playerId)?.user.id === userId
                );
                return me ? <p className="mt-1 text-sm font-medium">{me.relativeToPar}</p> : null;
              })()}
            </div>
            <Link href={`/play/${activeGame.id}`} className={buttonVariants({ className: "gap-1.5 rounded-full" })}>
              {h.continue} <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/20 sm:col-span-2">
          <CardContent className="flex h-full flex-col gap-4 py-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Flag className="size-5" />
              </span>
              <p className="font-heading text-xl font-semibold">{h.playCard}</p>
            </div>
            <p className="text-sm text-muted-foreground">{isNewUser ? h.playBodyNew : h.playBodyReturning}</p>
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link href="/play/new" className={buttonVariants({ size: "lg", className: "gap-1.5 rounded-full" })}>
                {h.playCta} <ArrowRight className="size-4" />
              </Link>
              {isNewUser && (
                <Link href="/coach" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  {h.beginnerPrompt} {h.beginnerCta}
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex h-full flex-col gap-3 py-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Brain className="size-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-semibold">{h.mindCard}</p>
              <p className="text-xs text-muted-foreground">{h.mindTagline}</p>
            </div>
            {hasMemory ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{h.mindMemoryIntro}</p>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground italic">&ldquo;{user.mindMemory}&rdquo;</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{h.mindPromptGeneric}</p>
            )}
            <Link
              href="/mind"
              className={buttonVariants({ variant: "outline", size: "sm", className: "mt-auto w-fit rounded-full" })}
            >
              {h.mindCta}
            </Link>
          </CardContent>
        </Card>
      </div>

      {(summary.lastGame || summary.latestInsight) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.lastGame && (
            <Card>
              <CardContent className="flex items-center justify-between gap-4 py-5">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{h.lastRoundTitle}</p>
                  <p className="mt-1 font-heading text-lg font-semibold">{summary.lastGame.course}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmt(h.lastRoundStrokes, { n: summary.lastGame.total })} · {summary.lastGame.relativeToPar}
                  </p>
                </div>
                <Link
                  href={`/play/${summary.lastGame.id}/resumen`}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-full" })}
                >
                  {h.lastRoundCta}
                </Link>
              </CardContent>
            </Card>
          )}

          {summary.latestInsight && (
            <Card>
              <CardContent className="flex flex-col gap-2 py-5">
                <p className="text-xs font-medium tracking-wide text-primary uppercase">{h.mindInsightTitle}</p>
                <p className="line-clamp-3 text-sm text-muted-foreground">{summary.latestInsight.insight}</p>
                <Link
                  href={`/play/${summary.latestInsight.id}/resumen`}
                  className="w-fit text-sm font-medium text-primary hover:underline"
                >
                  {h.mindInsightCta}
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardContent className="py-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{h.golfSectionTitle}</p>
          {summary.completedCount === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{h.golfEmptyState}</p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <p className="font-heading text-2xl font-semibold">{user.handicap ?? h.handicapEmpty}</p>
                <p className="text-xs text-muted-foreground">{h.handicapLabel}</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-semibold">{summary.completedCount}</p>
                <p className="text-xs text-muted-foreground">{h.roundsPlayedLabel}</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-semibold">{summary.bestGame?.total ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{h.bestRoundLabel}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {secondaryCards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-colors hover:border-primary/30 hover:bg-secondary/40">
              <CardContent className="flex flex-col items-start gap-2 py-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <c.icon className="size-4" />
                </span>
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
