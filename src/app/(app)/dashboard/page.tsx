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
import { MentalScoreRing } from "@/components/mental-score-ring";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
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
  let lastGameRelative: string | null = null;
  if (lastGame) {
    const { players, scores } = toStandingsInput(lastGame);
    const myPlayer = lastGame.players.find((p) => p.user.id === userId);
    if (myPlayer) {
      const standing = computeStrokeStandings(players, scores).find(
        (s) => s.playerId === myPlayer.id
      );
      lastGameGross = standing?.total ?? null;
      lastGameRelative = standing?.relativeToPar ?? null;
    }
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

            <div className="mt-3 grid shrink-0 grid-cols-2 gap-2">
              <Link
                href={heroHref}
                className="flex flex-col gap-1.5 rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/20">
                  <GolferSwingIcon className="size-4" />
                </span>
                <span className="text-sm font-semibold">{t.nav.play}</span>
                <span className="text-xs text-primary-foreground/80">
                  {t.dashboard.tilePlayDescription}
                </span>
                <span className="flex size-7 items-center justify-center rounded-full bg-white/20">
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
              <Link
                href="/coach"
                className="flex flex-col gap-1.5 rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur-sm"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Home className="size-4" strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold">{t.nav.coach}</span>
                <span className="text-xs text-muted-foreground">
                  {t.dashboard.tileCoachDescription}
                </span>
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
              <Link
                href="/aprende"
                className="flex flex-col gap-1.5 rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur-sm"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="size-4" strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold">{t.nav.learn}</span>
                <span className="text-xs text-muted-foreground">
                  {t.dashboard.tileLearnDescription}
                </span>
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
              <Link
                href="/community"
                className="flex flex-col gap-1.5 rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur-sm"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-4" strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold">{t.nav.community}</span>
                <span className="text-xs text-muted-foreground">
                  {t.dashboard.tileCommunityDescription}
                </span>
                <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
            </div>

            {activeGame && (
              <Link
                href={heroHref}
                className="mt-2 flex shrink-0 items-center gap-3 rounded-xl bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="size-3.5" strokeWidth={1.5} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">
                    {t.dashboard.nextRoundLabel}
                  </span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">
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
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            )}

            {/* Espaciador flexible: absorbe el alto sobrante en pantallas más
                altas, en vez de estirar las tarjetas de abajo. */}
            <div className="min-h-2 flex-1" />

            {/* Juego mental (anillo compacto) + Última vuelta — mismos datos reales, presentación reducida para caber sin scroll. */}
            <div className="grid shrink-0 grid-cols-2 gap-2">
              {mentalScore && mentalState ? (
                <Link
                  href="/insights"
                  className="flex items-center gap-2.5 overflow-hidden rounded-xl bg-card/95 p-2.5 shadow-lg backdrop-blur-sm"
                >
                  <div className="relative flex size-11 shrink-0 items-center justify-center">
                    <MentalScoreRing
                      score={mentalScore.score}
                      size={44}
                      strokeWidth={4}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-heading text-xs leading-none font-semibold">
                        {mentalScore.score}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">
                      {h.mentalGameTitle}
                    </p>
                    <p className="truncate text-[10.5px] text-primary">
                      {h[`state${capitalize(mentalState)}` as const]}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-white/50 bg-black/10 p-2.5 text-center backdrop-blur-sm">
                  <p className="text-[10.5px] text-white/90">
                    {h.mentalGameTitle}
                  </p>
                </div>
              )}

              {lastGame ? (
                <Link
                  href={`/play/${lastGame.id}/resumen`}
                  className="flex items-center gap-2.5 overflow-hidden rounded-xl bg-card/95 p-2.5 shadow-lg backdrop-blur-sm"
                >
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={DASHBOARD_PHOTOS.learn}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium">
                      {lastGame.course}
                    </p>
                    <p className="truncate text-[10.5px] text-muted-foreground">
                      {lastGameGross != null
                        ? `${lastGameGross} (${lastGameRelative})`
                        : h.lastRoundTitle}
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-white/50 bg-black/10 p-2.5 text-center backdrop-blur-sm">
                  <p className="text-[10.5px] text-white/90">
                    {h.lastRoundTitle}
                  </p>
                </div>
              )}
            </div>

            {/* Tu juego este mes — fila compacta de datos reales, sin scroll. */}
            <Link
              href="/insights"
              className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-xl bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                {monthlyTiles.map((tile) => (
                  <span key={tile.key} className="flex min-w-0 flex-col">
                    <span className="text-[9.5px] text-muted-foreground">
                      {tile.title}
                    </span>
                    <span className="truncate text-xs font-semibold">
                      {tile.state}
                    </span>
                  </span>
                ))}
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
