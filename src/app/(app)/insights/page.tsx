import { LineChart } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MoodChart } from "@/components/mood-chart";
import { TrendArrow } from "@/components/trend-arrow";
import { getDictionary } from "@/lib/i18n/current-locale";
import { computeMentalScore, moodTrend } from "@/lib/mood";
import { getMentalTrendData, getPressureByHoleRange, getRecoveryEvents } from "@/lib/data/insights";
import { computeClosingPressureInsight, computeMentalTrendInsight, computeRecoveryInsight } from "@/lib/insights";

/**
 * Insights cuenta lo que de verdad está pasando en el juego mental del
 * jugador — frases concretas sobre datos reales, nunca gráficas como
 * protagonista y nunca una frase inventada para rellenar la pantalla:
 * cada tarjeta que aparece está respaldada por un cálculo real (ver
 * src/lib/insights.ts) y solo se muestra cuando hay muestra suficiente.
 * Tres pestañas: Mental (tendencia + gráfica), Juego (presión en las
 * rondas) y Tendencias (los mismos números ya calculados en Home,
 * aquí con más espacio).
 */
export default async function InsightsPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const [mentalEntries, recoveryEvents, pressureData] = await Promise.all([
    getMentalTrendData(userId),
    getRecoveryEvents(userId),
    getPressureByHoleRange(userId),
  ]);

  if (mentalEntries.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.insights.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.insights.subtitle}</p>
        </div>
        <Card className="border-dashed border-border/70 shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-foreground/60">
              <LineChart className="size-5" strokeWidth={1.5} />
            </span>
            <div>
              <p className="font-heading text-lg font-semibold">{t.insights.emptyTitle}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{t.insights.emptyBody}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mentalScore = computeMentalScore(mentalEntries)!;
  const mentalTrend = computeMentalTrendInsight(mentalEntries);
  const recovery = computeRecoveryInsight(recoveryEvents);
  const closingPressure = computeClosingPressureInsight(pressureData.close, pressureData.rest);

  const chartData = moodTrend([...mentalEntries].reverse(), {
    hole: t.summary.chartHole,
    checkin: t.summary.chartCheckin,
  });

  const mentalCards = [
    mentalTrend && {
      key: "mentalTrend",
      eyebrow: mentalTrend.trend === "up" ? t.insights.strengthLabel : t.insights.opportunityLabel,
      text: mentalTrend.trend === "up" ? t.insights.mentalTrendUp : t.insights.mentalTrendDown,
    },
    recovery && {
      key: "recovery",
      eyebrow: recovery.trend === "up" ? t.insights.strengthLabel : t.insights.opportunityLabel,
      text: recovery.trend === "up" ? t.insights.recoveryUp : t.insights.recoveryDown,
    },
  ].filter((c): c is { key: string; eyebrow: string; text: string } => Boolean(c));

  const trendRows = [
    { label: t.home.confidenceLabel, trend: mentalScore.confidence },
    { label: t.home.focusLabel, trend: mentalScore.focus },
    { label: t.home.pressureLabel, trend: mentalScore.pressure },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.insights.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.insights.subtitle}</p>
      </div>

      <Tabs defaultValue="mental">
        <TabsList>
          <TabsTrigger value="mental">{t.insights.tabMental}</TabsTrigger>
          <TabsTrigger value="game">{t.insights.tabGame}</TabsTrigger>
          <TabsTrigger value="trends">{t.insights.tabTrends}</TabsTrigger>
        </TabsList>

        <TabsContent value="mental" className="mt-4 flex flex-col gap-4">
          <Card className="border-border/70 shadow-none">
            <CardContent className="py-4">
              <MoodChart data={chartData} emptyLabel={t.insights.emptyChart} />
            </CardContent>
          </Card>
          {mentalCards.length > 0 ? (
            <div className="flex flex-col gap-3">
              {mentalCards.map((card) => (
                <Card key={card.key} className="border-border/70 shadow-none">
                  <CardContent className="flex flex-col gap-1 py-4">
                    <p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">{card.eyebrow}</p>
                    <p className="text-sm">{card.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="game" className="mt-4">
          {closingPressure ? (
            <Card className="border-border/70 shadow-none">
              <CardContent className="flex flex-col gap-1 py-4">
                <p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
                  {t.insights.opportunityLabel}
                </p>
                <p className="text-sm">{t.insights.closingPressure}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-border/70 shadow-none">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {t.insights.emptyGameTab}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card className="border-border/70 shadow-none">
            <CardContent className="flex flex-col gap-4 py-5">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                  {t.insights.trendsScoreLabel}
                </p>
                <p className="font-heading text-3xl font-semibold">{mentalScore.score}</p>
              </div>
              <div className="flex flex-col gap-2.5 border-t border-border/70 pt-4 text-sm">
                {trendRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <TrendArrow trend={row.trend} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
