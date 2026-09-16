import Image from "next/image";
import Link from "next/link";
import {
  LineChart,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/page-transition";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendChart } from "@/components/trend-chart";
import { MentalPerformanceCard } from "@/components/mental-performance-card";
import { getDictionary } from "@/lib/i18n/current-locale";
import {
  computeMentalScore,
  mentalStateFromScore,
  MOOD_SCORE,
} from "@/lib/mood";
import {
  getMentalTrendData,
  getMentalEntriesBetween,
  getPressureByHoleRange,
  getRecoveryEvents,
  getRoundScoreTrend,
} from "@/lib/data/insights";
import {
  computeClosingPressureInsight,
  computeMentalPercentChange,
  computeMentalTrendInsight,
  computeRecoveryInsight,
} from "@/lib/insights";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Insights cuenta lo que de verdad está pasando en el juego mental del
 * jugador — nunca una frase inventada para rellenar la pantalla: cada
 * tarjeta está respaldada por un cálculo real (ver src/lib/insights.ts).
 * "Práctica" y "Bienestar" en Tendencias salen honestamente vacíos: la
 * app no trackea sesiones de práctica ni tiene una métrica de bienestar
 * separada del ánimo — no se fabrica una gráfica para esos dos.
 */
export default async function InsightsPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * DAY_MS);
  const start60 = new Date(now.getTime() - 60 * DAY_MS);

  const [
    mentalEntries,
    recoveryEvents,
    pressureData,
    current30,
    previous30,
    roundScoreTrend,
  ] = await Promise.all([
    getMentalTrendData(userId),
    getRecoveryEvents(userId),
    getPressureByHoleRange(userId),
    getMentalEntriesBetween(userId, start30, now),
    getMentalEntriesBetween(userId, start60, start30),
    getRoundScoreTrend(userId),
  ]);

  if (mentalEntries.length === 0) {
    return (
      <PageTransition>
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {t.insights.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.insights.subtitle}
            </p>
          </div>
          <Card className="border-dashed border-border/70 shadow-none">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-foreground/60">
                <LineChart className="size-5" strokeWidth={1.5} />
              </span>
              <div>
                <p className="font-heading text-lg font-semibold">
                  {t.insights.emptyTitle}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  {t.insights.emptyBody}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  const mentalScore = computeMentalScore(mentalEntries)!;
  const mentalState = mentalStateFromScore(mentalScore.score);
  const mentalTrend = computeMentalTrendInsight(mentalEntries);
  const recovery = computeRecoveryInsight(recoveryEvents);
  const closingPressure = computeClosingPressureInsight(
    pressureData.close,
    pressureData.rest
  );
  const percentChange = computeMentalPercentChange(current30, previous30);

  // Gráfica "Mental": cada check-in reciente reescalado a 0-100, en orden cronológico.
  const mentalChartData = [...mentalEntries]
    .reverse()
    .map((e, i) => ({
      label: `#${i + 1}`,
      value: Math.round(((MOOD_SCORE[e.mood] + 2) / 4) * 100),
    }));

  // Gráfica "En el campo": resultado relativo al par de cada ronda completada, en orden cronológico.
  const onCourseChartData = roundScoreTrend.map((p) => ({
    label: p.date.toLocaleDateString(t.dateLocale, {
      day: "numeric",
      month: "short",
    }),
    value: p.relative,
  }));
  const onCourseDomain: [number, number] =
    onCourseChartData.length > 0
      ? [
          Math.min(0, ...onCourseChartData.map((p) => p.value)) - 2,
          Math.max(0, ...onCourseChartData.map((p) => p.value)) + 2,
        ]
      : [0, 10];

  const keyInsights = [
    mentalTrend && {
      key: "mentalTrend",
      category: t.insights.categoryTrend,
      photo: "/images/coach-topic-swing.jpg",
      text:
        mentalTrend.trend === "up"
          ? t.insights.mentalTrendUp
          : t.insights.mentalTrendDown,
    },
    recovery && {
      key: "recovery",
      category: t.insights.categoryRecovery,
      photo: "/images/coach-topic-tree.jpg",
      text:
        recovery.trend === "up"
          ? t.insights.recoveryUp
          : t.insights.recoveryDown,
    },
    closingPressure && {
      key: "closingPressure",
      category: t.insights.categoryPressure,
      photo: "/images/coach-topic-cliff.jpg",
      text: t.insights.closingPressure,
    },
  ].filter(
    (c): c is { key: string; category: string; photo: string; text: string } =>
      Boolean(c)
  );

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {t.insights.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.insights.subtitle}
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-end text-right text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase sm:flex">
            <span>{t.insights.heroTagline1}</span>
            <span>{t.insights.heroTagline2}</span>
            <span>{t.insights.heroTagline3}</span>
            <span className="mt-1 h-px w-8 bg-border" />
          </div>
        </div>

        <div className="relative -mx-4 h-64 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:w-full sm:rounded-3xl">
          <Image
            src="/images/coach-hero.jpg"
            alt=""
            fill
            sizes="(min-width: 640px) 600px, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <p className="font-heading text-lg leading-tight text-white italic">
              {t.insights.photoTagline1}
              <br />
              {t.insights.photoTagline2}
            </p>
          </div>
        </div>

        <MentalPerformanceCard
          eyebrow={t.mind.mentalPerformanceTitle}
          headerRight={
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {t.insights.last30DaysLabel}
              <ChevronRight className="size-3" />
            </span>
          }
          mentalScore={mentalScore}
          mentalState={mentalState}
          homeT={t.home}
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {t.insights.tabTrends}
          </h2>
          <Tabs defaultValue="mental">
            <TabsList>
              <TabsTrigger value="mental">
                {t.insights.trendTabMental}
              </TabsTrigger>
              <TabsTrigger value="onCourse">
                {t.insights.trendTabOnCourse}
              </TabsTrigger>
              <TabsTrigger value="practice">
                {t.insights.trendTabPractice}
              </TabsTrigger>
              <TabsTrigger value="wellbeing">
                {t.insights.trendTabWellbeing}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mental" className="mt-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Card className="flex-1 border-border/70 shadow-none">
                  <CardContent className="py-4">
                    <TrendChart
                      data={mentalChartData}
                      domain={[0, 100]}
                      emptyLabel={t.insights.emptyChart}
                    />
                  </CardContent>
                </Card>
                {percentChange && (
                  <Card className="border-border/70 shadow-none sm:w-44 sm:shrink-0">
                    <CardContent className="flex flex-col gap-1 py-4">
                      <p className="font-heading text-2xl font-semibold text-primary">
                        {percentChange.percent > 0 ? "+" : ""}
                        {percentChange.percent}%
                      </p>
                      <p className="text-xs font-medium">
                        {t.insights.trendsScoreLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.insights.vsLastPeriod}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
                        {percentChange.trend === "up" ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <TrendingDown className="size-3.5" />
                        )}
                        {percentChange.trend === "up"
                          ? t.insights.positiveTrendLabel
                          : t.insights.negativeTrendLabel}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="onCourse" className="mt-4">
              <Card className="border-border/70 shadow-none">
                <CardContent className="py-4">
                  <TrendChart
                    data={onCourseChartData}
                    domain={onCourseDomain}
                    emptyLabel={t.insights.emptyOnCourseTab}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="practice" className="mt-4">
              <Card className="border-dashed border-border/70 shadow-none">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t.insights.emptyPracticeTab}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="wellbeing" className="mt-4">
              <Card className="border-dashed border-border/70 shadow-none">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t.insights.emptyWellbeingTab}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {keyInsights.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t.insights.keyInsightsTitle}
            </h2>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {keyInsights.map((insight) => (
                <div
                  key={insight.key}
                  className="relative h-44 w-40 shrink-0 overflow-hidden rounded-2xl"
                >
                  <Image
                    src={insight.photo}
                    alt=""
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-sm leading-tight font-medium text-white">
                      {insight.text}
                    </p>
                    <p className="mt-1.5 border-t border-white/25 pt-1.5 text-[9px] font-semibold tracking-[0.1em] text-white/70 uppercase">
                      {insight.category}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {t.insights.recommendationsTitle}
          </h2>
          <Link
            href="/aprende/rutina"
            className="flex items-center gap-4 rounded-2xl border border-border/70 p-3 transition-colors hover:border-primary/40"
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
              <Image
                src="/images/coach-topic-ball.jpg"
                alt=""
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                {t.coach.categoryLabels.mental}
              </p>
              <p className="font-heading text-base font-semibold">
                {t.preShotRoutine.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t.insights.recommendationRoutineDescription}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
