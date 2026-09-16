import Link from "next/link";
import Image from "next/image";
import {
  Home,
  Gauge,
  ChevronRight,
  ArrowRight,
  CalendarDays,
  GraduationCap,
  Users,
  TrendingUp,
  Sun,
  Target,
  Activity,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import {
  getLastCompletedGameForUser,
  getActiveGamesForUser,
  getMonthlyRelativeToPar,
} from "@/lib/data/games";
import { getDictionary } from "@/lib/i18n/current-locale";
import { PageTransition } from "@/components/page-transition";
import { GolferSwingIcon } from "@/components/golfer-swing-icon";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { prisma } from "@/lib/prisma";
import { computeMentalScore, mentalStateFromScore } from "@/lib/mood";
import {
  computeMentalTrendInsight,
  computeMonthlyScoringTrend,
} from "@/lib/insights";
import { TrendArrow } from "@/components/trend-arrow";
import { MentalScoreRing } from "@/components/mental-score-ring";
import { toStandingsInput } from "@/lib/games/adapt";
import {
  computeNetStrokeStandings,
  computeStrokeStandings,
} from "@/lib/games/standings";
import { fmt } from "@/lib/i18n/format";
import type { LucideIcon } from "lucide-react";

const MENTAL_SCORE_SAMPLE_SIZE = 14;

/**
 * Home: foto real de marca a pantalla completa (home-hero-v2.jpg) con el
 * titular y 4 accesos grandes encima (Jugar/Coach/Aprende/Comunidad,
 * mismos destinos que la barra inferior) + la próxima vuelta si existe.
 * Debajo, sin cambios de fondo: Juego mental (anillo) y Última vuelta en
 * dos columnas, y Tu juego este mes como lista editorial. Todo dato
 * mostrado es real (computeMentalScore, el motor de hándicap de Fase B,
 * los insights de Fase E) — "Fairways"/"GIR" de referencias antiguas no
 * se muestran porque la app no trackea golpe de salida ni green en
 * regulación: se sustituyen por Putts (Score.putts, cuando existe para
 * TODOS los hoyos jugados) y la puntuación mental de esa ronda concreta,
 * nunca fabricados.
 */
export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;

  const [lastGame, activeGames, recentMoods, monthlyRelatives] =
    await Promise.all([
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
  const mentalState = mentalScore
    ? mentalStateFromScore(mentalScore.score)
    : null;
  const evolutionInsight = computeMentalTrendInsight(recentMoods);
  const scoringTrend = computeMonthlyScoringTrend(
    monthlyRelatives.current,
    monthlyRelatives.previous
  );
  const roundsThisMonth = monthlyRelatives.current.length;

  const activeGame = activeGames[0] ?? null;

  let lastGameGross: number | null = null;
  let lastGameNet: number | null = null;
  let lastGameRelative: string | null = null;
  let lastGamePutts: number | null = null;
  let lastGameMentalScore: number | null = null;
  if (lastGame) {
    const { players, scores } = toStandingsInput(lastGame);
    const myPlayer = lastGame.players.find((p) => p.user.id === userId);
    if (myPlayer) {
      const standing = computeStrokeStandings(players, scores).find(
        (s) => s.playerId === myPlayer.id
      );
      lastGameGross = standing?.total ?? null;
      lastGameRelative = standing?.relativeToPar ?? null;

      const handicapsByPlayerId = Object.fromEntries(
        lastGame.players.map((p) => [p.id, p.user.handicap])
      );
      const net = computeNetStrokeStandings(
        players,
        scores,
        handicapsByPlayerId
      ).find((s) => s.playerId === myPlayer.id);
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

  type MonthlyTile = {
    key: string;
    icon: LucideIcon;
    title: string;
    state: string;
    description: string;
  };
  const monthlyTiles: MonthlyTile[] = [];
  if (scoringTrend) {
    monthlyTiles.push({
      key: "scoring",
      icon: TrendingUp,
      title: h.scoringLabel,
      state:
        scoringTrend.trend === "up" ? h.scoringImproving : h.scoringDeclining,
      description: fmt(
        scoringTrend.trend === "up"
          ? h.scoringBodyImproving
          : h.scoringBodyDeclining,
        {
          n: Math.abs(scoringTrend.diff),
        }
      ),
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
      state:
        evolutionInsight.trend === "up"
          ? h.mentalMonthlyImproving
          : h.mentalMonthlyDeclining,
      description:
        evolutionInsight.trend === "up"
          ? h.mentalMonthlyBodyImproving
          : h.mentalMonthlyBodyDeclining,
    });
  }

  return (
    <PageTransition>
      <div className="flex flex-col gap-8">
        {/* 1. Hero a pantalla completa: sin cabecera ni barra inferior (ver AppShell) — solo la foto, la marca, el titular, los 4 accesos y la próxima vuelta.
            h-svh + overflow-hidden: cabe todo en una pantalla, sin scroll (el resto de Home sigue debajo, alcanzable con scroll si se quiere). */}
        <div className="relative h-svh overflow-hidden">
          <Image
            src="/images/home-hero-v2.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
          <div className="relative flex h-full flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <div className="flex shrink-0 items-start justify-between">
              <div className="flex shrink-0 flex-col leading-none">
                <span className="font-sans text-3xl font-bold tracking-tight text-white">
                  MYS
                </span>
                <span className="mt-0.5 text-xs text-white/90">
                  Mind Your Swing
                </span>
              </div>
              <Link href="/perfil" aria-label={t.nav.perfil}>
                {session?.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? t.nav.perfil}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
                    {session?.user.name?.[0] ?? "?"}
                  </div>
                )}
              </Link>
            </div>

            <div className="mt-3 shrink-0">
              <h1 className="font-heading text-2xl leading-[1.1] font-semibold text-white sm:text-[32px]">
                {t.dashboard.heroHeadline}
              </h1>
              <p className="mt-1.5 text-sm text-white/90">
                {t.dashboard.heroTagline}
              </p>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col justify-center gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={heroHref}
                  className="flex flex-col gap-2 rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-white/20">
                    <GolferSwingIcon className="size-4" />
                  </span>
                  <span className="text-sm font-semibold">{t.nav.play}</span>
                  <span className="text-xs text-primary-foreground/80">
                    {t.dashboard.tilePlayDescription}
                  </span>
                  <span className="mt-1 flex size-7 items-center justify-center rounded-full bg-white/20">
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
                <Link
                  href="/coach"
                  className="flex flex-col gap-2 rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur-sm"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Home className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="text-sm font-semibold">{t.nav.coach}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.dashboard.tileCoachDescription}
                  </span>
                  <span className="mt-1 flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
                <Link
                  href="/aprende"
                  className="flex flex-col gap-2 rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur-sm"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="text-sm font-semibold">{t.nav.learn}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.dashboard.tileLearnDescription}
                  </span>
                  <span className="mt-1 flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
                <Link
                  href="/community"
                  className="flex flex-col gap-2 rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur-sm"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="text-sm font-semibold">
                    {t.nav.community}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t.dashboard.tileCommunityDescription}
                  </span>
                  <span className="mt-1 flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              </div>

              {activeGame && (
                <Link
                  href={heroHref}
                  className="flex shrink-0 items-center gap-3 rounded-2xl bg-card/95 p-3.5 shadow-lg backdrop-blur-sm"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDays className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {t.dashboard.nextRoundLabel}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {activeGame.course} ·{" "}
                      {new Date(activeGame.date).toLocaleDateString(
                        t.dateLocale,
                        { weekday: "long", day: "numeric", month: "short" }
                      )}{" "}
                      ·{" "}
                      {new Date(activeGame.date).toLocaleTimeString(
                        t.dateLocale,
                        { hour: "2-digit", minute: "2-digit" }
                      )}
                    </span>
                  </span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* Sin AppShell en esta pantalla (ver isImmersivePage), así que el
            padding de página que antes daba <main> hay que darlo aquí,
            solo para el contenido bajo el hero, no para la foto. */}
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6">
          {/* 2. Juego mental (anillo) + Última vuelta — dos columnas compactas. */}
          <div className="grid grid-cols-2 gap-3">
            {mentalScore && mentalState ? (
              <Link
                href="/insights"
                className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium">{h.mentalGameTitle}</p>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex size-[72px] shrink-0 items-center justify-center">
                    <MentalScoreRing
                      score={mentalScore.score}
                      size={72}
                      strokeWidth={6}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-heading text-xl leading-none font-semibold">
                        {mentalScore.score}
                      </span>
                      <span className="text-[8px] text-muted-foreground">
                        /100
                      </span>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[10.5px] text-muted-foreground">
                    <span className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        <Sun className="size-3 shrink-0" strokeWidth={1.5} />
                        {h.confidenceLabel}
                      </span>
                      <TrendArrow trend={mentalScore.confidence} />
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        <Target className="size-3 shrink-0" strokeWidth={1.5} />
                        {h.focusLabel}
                      </span>
                      <TrendArrow trend={mentalScore.focus} />
                    </span>
                    <span className="flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        <Activity
                          className="size-3 shrink-0"
                          strokeWidth={1.5}
                        />
                        {h.pressureLabel}
                      </span>
                      <TrendArrow trend={mentalScore.pressure} />
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">
                    {h[`state${capitalize(mentalState)}` as const]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {h[`stateBody${capitalize(mentalState)}` as const]}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/70 p-4 text-center">
                <p className="text-[13px] font-medium">{h.mentalGameTitle}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {h.evolutionEmpty}
                </p>
              </div>
            )}

            {lastGame ? (
              <Link
                href={`/play/${lastGame.id}/resumen`}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium">{h.lastRoundTitle}</p>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={DASHBOARD_PHOTOS.learn}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lastGame.course}
                    </p>
                    <p className="truncate text-[10.5px] text-muted-foreground">
                      {new Date(lastGame.date).toLocaleDateString(
                        t.dateLocale,
                        {
                          day: "numeric",
                          month: "short",
                        }
                      )}
                      {" · "}
                      {fmt(t.summary.holesTotal, {
                        total: lastGame.holes.length,
                      })}
                    </p>
                  </div>
                </div>
                {lastGameGross != null && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-heading text-2xl leading-none font-semibold">
                      {lastGameGross}
                    </span>
                    {lastGameRelative && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                        {lastGameRelative}
                      </span>
                    )}
                  </div>
                )}
                {(lastGamePutts != null ||
                  lastGameMentalScore != null ||
                  lastGameNet != null) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-[10.5px] text-muted-foreground">
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
              </Link>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/70 p-4 text-center">
                <p className="text-[13px] font-medium">{h.lastRoundTitle}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {h.lastRoundInsightFallback}
                </p>
              </div>
            )}
          </div>

          {/* 3. Tu juego este mes — cuadrícula editorial compacta, no cuatro tarjetas grandes. */}
          <div className="flex flex-col gap-4 border-t border-border/70 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">{h.monthlyTitle}</h2>
              <Link
                href="/insights"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {h.viewAllInsights}
                <ChevronRight className="size-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5">
              {monthlyTiles.map((tile) => (
                <div key={tile.key} className="flex flex-col gap-1.5">
                  <tile.icon
                    className="size-4 shrink-0 text-primary"
                    strokeWidth={1.5}
                  />
                  <p className="text-xs leading-tight text-muted-foreground">
                    {tile.title}
                  </p>
                  <p className="text-sm leading-tight font-medium">
                    {tile.state}
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {tile.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
