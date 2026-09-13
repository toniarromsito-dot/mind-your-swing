import Link from "next/link";
import Image from "next/image";
import { Bell, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getLastCompletedGameForUser, getActiveGamesForUser } from "@/lib/data/games";
import { getDictionary } from "@/lib/i18n/current-locale";
import { TimeGreeting } from "@/components/time-greeting";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { prisma } from "@/lib/prisma";
import { computeMentalScore, mentalStateFromScore } from "@/lib/mood";
import { computeMentalTrendInsight } from "@/lib/insights";
import { TrendArrow } from "@/components/trend-arrow";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeNetStrokeStandings, computeStrokeStandings } from "@/lib/games/standings";
import { fmt } from "@/lib/i18n/format";

const MENTAL_SCORE_SAMPLE_SIZE = 14;

/**
 * Home no es una pila de tarjetas iguales — es una composición editorial
 * con pesos visuales distintos: saludo (ligero) → próxima ronda (hero,
 * la pieza principal) → instantánea mental (número protagonista) →
 * última vuelta (con historia) → evolución (cierre en voz baja). Cada
 * sección reutiliza datos ya calculados en otras fases (computeMentalScore,
 * el motor de hándicap de Fase B, los insights reales de Fase E) — el
 * cambio aquí es de jerarquía visual, no de qué datos existen.
 */
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
  const mentalState = mentalScore ? mentalStateFromScore(mentalScore.score) : null;
  const evolutionInsight = computeMentalTrendInsight(recentMoods);

  const activeGame = activeGames[0] ?? null;
  const myHandicap = activeGame?.players.find((p) => p.user.id === userId)?.user.handicap ?? null;

  let lastGameGross: number | null = null;
  let lastGameNet: number | null = null;
  let lastGameRelative: string | null = null;
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
    }
  }

  const heroHref = activeGame ? `/play/${activeGame.id}` : "/play/new";
  const heroEyebrow = activeGame ? (activeGame.started ? h.inProgressEyebrow : h.nextRoundEyebrow) : h.noRoundEyebrow;
  const heroCta = activeGame ? (activeGame.started ? h.continueRoundCta : h.nextRoundCta) : t.dashboard.startRound;

  return (
    <div className="flex flex-col gap-12">
      {/* 1. Saludo personal — ligero, no un mensaje de bienvenida de SaaS. */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-[34px] leading-[1.1] font-semibold tracking-tight text-balance sm:text-[40px]">
            <TimeGreeting
              fallback={t.dashboard.greeting(firstName)}
              morning={t.dashboard.greetingMorning(firstName)}
              afternoon={t.dashboard.greetingAfternoon(firstName)}
              evening={t.dashboard.greetingEvening(firstName)}
            />
          </h1>
          <p className="mt-2 text-base text-muted-foreground">{h.feelingPrompt}</p>
        </div>
        <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground/70">
          <Bell className="size-4" strokeWidth={1.5} />
        </span>
      </div>

      {/* 2. Próxima ronda — sección hero, la pieza principal de Home. */}
      <Link href={heroHref} className="group block">
        <div className="relative overflow-hidden rounded-3xl shadow-md transition-transform group-hover:-translate-y-0.5">
          <div className="relative h-64 w-full sm:h-72">
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
          <div className="absolute inset-0 flex flex-col justify-end p-6">
            <span className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">{heroEyebrow}</span>
            {activeGame ? (
              <>
                <p className="mt-2 font-heading text-3xl font-semibold text-white sm:text-4xl">{activeGame.course}</p>
                <p className="mt-2 text-sm text-white/80">
                  {new Date(activeGame.date).toLocaleDateString(t.dateLocale, { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}
                  {fmt(t.summary.holesTotal, { total: activeGame.holes.length })}
                  {myHandicap != null && <> · {fmt(h.handicapShort, { n: myHandicap })}</>}
                </p>
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

      {/* 3. Tu juego mental — instantánea de rendimiento, el número manda. */}
      {mentalScore && mentalState && (
        <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{h.mentalGameTitle}</h2>
          <p className="font-heading text-7xl font-semibold tracking-tight">{mentalScore.score}</p>
          <p className="text-lg font-medium text-primary">{h[`state${capitalize(mentalState)}` as const]}</p>
          <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {h.confidenceLabel} <TrendArrow trend={mentalScore.confidence} />
            </span>
            <span className="flex items-center gap-1.5">
              {h.focusLabel} <TrendArrow trend={mentalScore.focus} />
            </span>
            <span className="flex items-center gap-1.5">
              {h.pressureLabel} <TrendArrow trend={mentalScore.pressure} />
            </span>
          </div>
        </div>
      )}

      {/* 4. Última vuelta — cuenta la vuelta, no enumera cada estadística. */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{h.lastRoundTitle}</h2>
        {lastGame ? (
          <Link href={`/play/${lastGame.id}/resumen`} className="group">
            <p className="font-heading text-2xl font-semibold transition-colors group-hover:text-primary">
              {lastGame.course}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                {new Date(lastGame.date).toLocaleDateString(t.dateLocale, { day: "numeric", month: "long" })}
              </span>
              {lastGameGross != null && (
                <span className="font-medium tabular-nums text-foreground">
                  {lastGameGross} {t.summary.strokes.toLowerCase()}
                  {lastGameRelative && ` (${lastGameRelative})`}
                </span>
              )}
              {lastGameNet != null && (
                <span className="tabular-nums">
                  {h.grossLabel} {lastGameGross} · {t.summary.netLabel} {lastGameNet}
                </span>
              )}
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground italic">
              {lastGame.insight ? lastGame.insight.split("\n")[0] : h.lastRoundInsightFallback}
            </p>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">{h.lastRoundInsightFallback}</p>
        )}
      </div>

      {/* 5. Tu evolución — cierre en voz baja, un insight real o nada. */}
      <div className="flex flex-col gap-2 border-t border-border/70 pt-6">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">{h.evolutionTitle}</h2>
        {evolutionInsight ? (
          <p className="text-sm text-muted-foreground">
            {evolutionInsight.trend === "up" ? t.insights.mentalTrendUp : t.insights.mentalTrendDown}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{h.evolutionEmpty}</p>
        )}
        <Link href="/insights" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {h.viewInsights}
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
