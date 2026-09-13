import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, Flag as FlagIcon, Gauge, ChevronRight, CalendarDays, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getLastCompletedGameForUser, getActiveGamesForUser, getMonthlyRelativeToPar } from "@/lib/data/games";
import { getDictionary } from "@/lib/i18n/current-locale";
import { TimeGreeting } from "@/components/time-greeting";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { prisma } from "@/lib/prisma";
import { computeMentalScore, mentalStateFromScore } from "@/lib/mood";
import { computeMentalTrendInsight, computeMonthlyScoringTrend } from "@/lib/insights";
import { TrendArrow } from "@/components/trend-arrow";
import { MentalScoreRing } from "@/components/mental-score-ring";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeNetStrokeStandings, computeStrokeStandings } from "@/lib/games/standings";
import { fmt } from "@/lib/i18n/format";
import type { LucideIcon } from "lucide-react";

const MENTAL_SCORE_SAMPLE_SIZE = 14;

/**
 * Home reproduce la referencia visual de 1 panel entregada por el
 * usuario: hero editorial con foto integrada → Próxima ronda como
 * tarjeta fotográfica dominante → Juego mental (anillo) y Última vuelta
 * en dos columnas → Tu juego este mes como lista editorial. Todo dato
 * mostrado es real (computeMentalScore, el motor de hándicap de Fase B,
 * los insights de Fase E) — "Fairways"/"GIR" de la referencia no se
 * muestran porque la app no trackea golpe de salida ni green en
 * regulación: se sustituyen por Putts (Score.putts, cuando existe para
 * TODOS los hoyos jugados) y la puntuación mental de esa ronda concreta,
 * nunca fabricados.
 */
export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;
  const firstName = session?.user.name?.split(" ")[0] ?? "";

  const [lastGame, activeGames, recentMoods, monthlyRelatives] = await Promise.all([
    getLastCompletedGameForUser(userId),
    getActiveGamesForUser(userId),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MENTAL_SCORE_SAMPLE_SIZE,
      select: { mood: true },
    }),
    getMonthlyRelativeToPar(userId),
  ]);

  const mentalScore = computeMentalScore(recentMoods);
  const mentalState = mentalScore ? mentalStateFromScore(mentalScore.score) : null;
  const evolutionInsight = computeMentalTrendInsight(recentMoods);
  const scoringTrend = computeMonthlyScoringTrend(monthlyRelatives.current, monthlyRelatives.previous);
  const roundsThisMonth = monthlyRelatives.current.length;

  const activeGame = activeGames[0] ?? null;
  const myHandicap = activeGame?.players.find((p) => p.user.id === userId)?.user.handicap ?? null;

  let lastGameGross: number | null = null;
  let lastGameNet: number | null = null;
  let lastGameRelative: string | null = null;
  let lastGamePutts: number | null = null;
  let lastGameMentalScore: number | null = null;
  if (lastGame) {
    const { players, scores } = toStandingsInput(lastGame);
    const myPlayer = lastGame.players.find((p) => p.user.id === userId);
    if (myPlayer) {
      const standing = computeStrokeStandings(players, scores).find((s) => s.playerId === myPlayer.id);
      lastGameGross = standing?.total ?? null;
      lastGameRelative = standing?.relativeToPar ?? null;

      const handicapsByPlayerId = Object.fromEntries(lastGame.players.map((p) => [p.id, p.user.handicap]));
      const net = computeNetStrokeStandings(players, scores, handicapsByPlayerId).find(
        (s) => s.playerId === myPlayer.id
      );
      lastGameNet = net?.net ?? null;

      const playedScores = myPlayer.scores.filter((s) => s.strokes != null);
      const puttsValues = playedScores.map((s) => s.putts);
      if (playedScores.length > 0 && puttsValues.every((p) => p != null)) {
        lastGamePutts = puttsValues.reduce((sum, p) => sum + p, 0);
      }
    }

    const roundMoods = await prisma.moodEntry.findMany({
      where: { gameId: lastGame.id, userId },
      select: { mood: true },
    });
    lastGameMentalScore = computeMentalScore(roundMoods)?.score ?? null;
  }

  const heroHref = activeGame ? `/play/${activeGame.id}` : "/play/new";
  const heroEyebrow = activeGame ? (activeGame.started ? h.inProgressEyebrow : h.nextRoundEyebrow) : h.noRoundEyebrow;
  const heroCta = activeGame ? (activeGame.started ? h.continueRoundCta : h.nextRoundCta) : t.dashboard.startRound;

  type MonthlyTile = { key: string; icon: LucideIcon; title: string; state: string; description: string };
  const monthlyTiles: MonthlyTile[] = [];
  if (scoringTrend) {
    monthlyTiles.push({
      key: "scoring",
      icon: TrendingUp,
      title: h.scoringLabel,
      state: scoringTrend.trend === "up" ? h.scoringImproving : h.scoringDeclining,
      description: fmt(scoringTrend.trend === "up" ? h.scoringBodyImproving : h.scoringBodyDeclining, {
        n: Math.abs(scoringTrend.diff),
      }),
    });
  }
  monthlyTiles.push({
    key: "rounds",
    icon: CalendarDays,
    title: h.roundsThisMonthLabel,
    state: String(roundsThisMonth),
    description: fmt(h.roundsThisMonthBody, { n: roundsThisMonth }),
  });
  if (evolutionInsight) {
    monthlyTiles.push({
      key: "mental",
      icon: Gauge,
      title: h.mentalMonthlyLabel,
      state: evolutionInsight.trend === "up" ? h.mentalMonthlyImproving : h.mentalMonthlyDeclining,
      description: evolutionInsight.trend === "up" ? h.mentalMonthlyBodyImproving : h.mentalMonthlyBodyDeclining,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Hero editorial: eyebrow + saludo grande + foto integrada + tagline. */}
      <section className="relative">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-primary/70 uppercase">{h.eyebrow}</p>
        <div className="relative mt-3 max-w-[58%] sm:max-w-[64%]">
          <h1 className="font-heading text-[32px] leading-[1.05] font-semibold tracking-tight text-balance sm:text-[40px]">
            <TimeGreeting
              fallback={t.dashboard.greeting(firstName)}
              morning={t.dashboard.greetingMorning(firstName)}
              afternoon={t.dashboard.greetingAfternoon(firstName)}
              evening={t.dashboard.greetingEvening(firstName)}
            />
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{h.feelingPrompt}</p>
        </div>

        <div
          className="pointer-events-none absolute top-0 right-0 h-[200px] w-[46%] overflow-hidden rounded-3xl sm:w-[38%]"
          style={{
            maskImage: "linear-gradient(to left, black 45%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to left, black 45%, transparent 100%)",
          }}
        >
          <Image src={DASHBOARD_PHOTOS.play} alt="" fill sizes="220px" className="object-cover opacity-90" />
        </div>

        <div className="mt-8 flex items-center gap-3">
          <div>
            <p className="font-heading text-base leading-tight italic">{h.tagline1}</p>
            <p className="font-heading text-base leading-tight italic">{h.tagline2}</p>
          </div>
          <span className="h-px flex-1 bg-border" />
        </div>
      </section>

      {/* 2. Próxima ronda — tarjeta fotográfica dominante, no un botón. */}
      <Link href={heroHref} className="group block">
        <div className="relative overflow-hidden rounded-[28px] shadow-md transition-transform group-hover:-translate-y-0.5">
          <div className="relative h-72 w-full sm:h-80">
            <Image
              src={DASHBOARD_PHOTOS.play}
              alt=""
              fill
              sizes="(min-width: 640px) 600px, 100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          </div>

          {activeGame && (
            <div className="absolute top-5 right-5 flex flex-col items-end gap-1 text-right text-[9.5px] font-medium tracking-[0.25em] text-white/70 uppercase">
              <span>{h.playTag}</span>
              <span>{h.practiceTag}</span>
              <span>{h.improveTag}</span>
              <span className="mt-1 h-px w-8 bg-white/40" />
            </div>
          )}

          <div className="absolute inset-0 flex flex-col justify-end p-6">
            <span className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">{heroEyebrow}</span>
            {activeGame ? (
              <>
                <p className="mt-2 font-heading text-3xl font-semibold text-white sm:text-4xl">{activeGame.course}</p>
                <div className="mt-3 flex flex-col gap-1.5 text-sm text-white/85">
                  <span className="flex items-center gap-2">
                    <Calendar className="size-3.5 shrink-0" strokeWidth={1.5} />
                    {new Date(activeGame.date).toLocaleDateString(t.dateLocale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="size-3.5 shrink-0" strokeWidth={1.5} />
                    {new Date(activeGame.date).toLocaleTimeString(t.dateLocale, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex items-center gap-2">
                    <FlagIcon className="size-3.5 shrink-0" strokeWidth={1.5} />
                    {fmt(t.summary.holesTotal, { total: activeGame.holes.length })}
                  </span>
                  {myHandicap != null && (
                    <span className="flex items-center gap-2">
                      <Gauge className="size-3.5 shrink-0" strokeWidth={1.5} />
                      {fmt(h.handicapShort, { n: myHandicap })}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-2 max-w-xs text-sm text-white/80">{h.noRoundBody}</p>
            )}
            <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary shadow-sm">
              {heroCta}
              <ChevronRight className="size-4" />
            </span>
          </div>
        </div>
      </Link>

      {/* 3. Juego mental (anillo) + Última vuelta — dos columnas compactas. */}
      <div className="grid grid-cols-2 gap-3">
        {mentalScore && mentalState ? (
          <Link
            href="/insights"
            className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4 transition-colors hover:border-primary/40"
          >
            <p className="text-[10.5px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              {h.mentalGameTitle}
            </p>
            <div className="relative mx-auto flex size-[84px] items-center justify-center">
              <MentalScoreRing score={mentalScore.score} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-2xl leading-none font-semibold">{mentalScore.score}</span>
                <span className="text-[9px] text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-primary">{h[`state${capitalize(mentalState)}` as const]}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {h[`stateBody${capitalize(mentalState)}` as const]}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center justify-between">
                {h.confidenceLabel} <TrendArrow trend={mentalScore.confidence} />
              </span>
              <span className="flex items-center justify-between">
                {h.focusLabel} <TrendArrow trend={mentalScore.focus} />
              </span>
              <span className="flex items-center justify-between">
                {h.pressureLabel} <TrendArrow trend={mentalScore.pressure} />
              </span>
            </div>
          </Link>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/70 p-4 text-center">
            <p className="text-[10.5px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              {h.mentalGameTitle}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{h.evolutionEmpty}</p>
          </div>
        )}

        {lastGame ? (
          <Link
            href={`/play/${lastGame.id}/resumen`}
            className="flex flex-col overflow-hidden rounded-2xl border border-border/70 transition-colors hover:border-primary/40"
          >
            <div className="relative h-20 w-full">
              <Image src={DASHBOARD_PHOTOS.learn} alt="" fill sizes="200px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div>
                <p className="truncate text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                  {h.lastRoundTitle}
                </p>
                <p className="truncate text-sm font-medium">{lastGame.course}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(lastGame.date).toLocaleDateString(t.dateLocale, { day: "numeric", month: "short" })}
                  {" · "}
                  {fmt(t.summary.holesTotal, { total: lastGame.holes.length })}
                </p>
              </div>
              {lastGameGross != null && (
                <div className="flex items-baseline gap-2">
                  <span className="font-heading text-2xl leading-none font-semibold">{lastGameGross}</span>
                  {lastGameRelative && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {lastGameRelative}
                    </span>
                  )}
                </div>
              )}
              {(lastGamePutts != null || lastGameMentalScore != null || lastGameNet != null) && (
                <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-[10.5px] text-muted-foreground">
                  {lastGameNet != null && (
                    <span>
                      {t.summary.netLabel} {lastGameNet}
                    </span>
                  )}
                  {lastGamePutts != null && (
                    <span>
                      {lastGamePutts} {h.puttsLabel}
                    </span>
                  )}
                  {lastGameMentalScore != null && (
                    <span>
                      {lastGameMentalScore} {h.mentalShortLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/70 p-4 text-center">
            <p className="text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              {h.lastRoundTitle}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">{h.lastRoundInsightFallback}</p>
          </div>
        )}
      </div>

      {/* 4. Tu juego este mes — lista editorial, no cuatro tarjetas grandes. */}
      <div className="flex flex-col gap-1 border-t border-border/70 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {h.monthlyTitle}
          </h2>
          <Link href="/insights" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {h.viewAllInsights}
            <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="flex flex-col divide-y divide-border/60">
          {monthlyTiles.map((tile) => (
            <div key={tile.key} className="flex items-start gap-3 py-3.5">
              <tile.icon className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  {tile.title}
                </p>
                <p className="mt-0.5 text-sm font-medium">{tile.state}</p>
                <p className="text-xs text-muted-foreground">{tile.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
