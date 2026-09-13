import Link from "next/link";
import Image from "next/image";
import { Bell, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getLastCompletedGameForUser, getActiveGamesForUser } from "@/lib/data/games";
import { Card, CardContent } from "@/components/ui/card";
import { MentalScoreCard } from "@/components/mental-score-card";
import { TimeGreeting } from "@/components/time-greeting";
import { buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { prisma } from "@/lib/prisma";
import { computeMentalScore } from "@/lib/mood";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
import { cn } from "@/lib/utils";

const MENTAL_SCORE_SAMPLE_SIZE = 14;

export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;
  const firstName = session?.user.name?.split(" ")[0] ?? "";

  const [lastGame, activeGames, recentMoods] = await Promise.all([
    getLastCompletedGameForUser(userId),
    getActiveGamesForUser(userId),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MENTAL_SCORE_SAMPLE_SIZE,
      select: { mood: true },
    }),
  ]);
  const mentalScore = computeMentalScore(recentMoods);
  const activeGame = activeGames[0] ?? null;

  let lastGameStrokes: number | null = null;
  if (lastGame) {
    const { players, scores } = toStandingsInput(lastGame);
    const myPlayer = lastGame.players.find((p) => p.user.id === userId);
    const standing = myPlayer ? computeStrokeStandings(players, scores).find((s) => s.playerId === myPlayer.id) : null;
    lastGameStrokes = standing?.total ?? null;
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-[28px] leading-tight font-semibold tracking-tight text-balance">
            <TimeGreeting
              fallback={t.dashboard.greeting(firstName)}
              morning={t.dashboard.greetingMorning(firstName)}
              afternoon={t.dashboard.greetingAfternoon(firstName)}
              evening={t.dashboard.greetingEvening(firstName)}
            />
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t.dashboard.readyToPlay}</p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground/70">
          <Bell className="size-4" strokeWidth={1.5} />
        </span>
      </div>

      <Link
        href={activeGame ? `/play/${activeGame.id}` : "/play/new"}
        className={buttonVariants({ size: "lg", className: "gap-2 self-start rounded-full px-7 text-base" })}
      >
        {activeGame ? h.nextRoundTitle : t.dashboard.startRound}
        <ChevronRight className="size-4" />
      </Link>

      {mentalScore && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">{h.mentalGameTitle}</h2>
          <MentalScoreCard
            score={mentalScore}
            labels={{ confidence: h.confidenceLabel, focus: h.focusLabel, pressure: h.pressureLabel }}
          />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">{h.lastRoundTitle}</h2>
        {lastGame ? (
          <Link href={`/play/${lastGame.id}/resumen`}>
            <Card className="overflow-hidden border-border/70 shadow-none transition-colors hover:bg-secondary/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                  <Image src={DASHBOARD_PHOTOS.play} alt="" fill sizes="56px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-heading text-base font-semibold">{lastGame.course}</p>
                    {lastGameStrokes != null && (
                      <p className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                        {lastGameStrokes} {t.summary.strokes.toLowerCase()}
                      </p>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground italic">
                    {lastGame.insight ? lastGame.insight.split("\n")[0] : h.lastRoundInsightFallback}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className={cn("border-dashed border-border/70 shadow-none")}>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {h.lastRoundInsightFallback}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
