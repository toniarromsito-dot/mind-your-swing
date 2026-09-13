import { LineChart } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/current-locale";
import { getMentalTrendData, getPressureByHoleRange, getRecoveryEvents } from "@/lib/data/insights";
import { computeClosingPressureInsight, computeMentalTrendInsight, computeRecoveryInsight } from "@/lib/insights";

/**
 * Insights cuenta lo que de verdad está pasando en el juego mental del
 * jugador — frases concretas sobre datos reales, nunca gráficas como
 * protagonista y nunca una frase inventada para rellenar la pantalla:
 * cada tarjeta que aparece está respaldada por un cálculo real (ver
 * src/lib/insights.ts) y solo se muestra cuando hay muestra suficiente.
 */
export default async function InsightsPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const [mentalEntries, recoveryEvents, pressureData] = await Promise.all([
    getMentalTrendData(userId),
    getRecoveryEvents(userId),
    getPressureByHoleRange(userId),
  ]);

  const mentalTrend = computeMentalTrendInsight(mentalEntries);
  const recovery = computeRecoveryInsight(recoveryEvents);
  const closingPressure = computeClosingPressureInsight(pressureData.close, pressureData.rest);

  const cards = [
    mentalTrend && (mentalTrend.trend === "up" ? t.insights.mentalTrendUp : t.insights.mentalTrendDown),
    recovery && (recovery.trend === "up" ? t.insights.recoveryUp : t.insights.recoveryDown),
    closingPressure && t.insights.closingPressure,
  ].filter((text): text is string => Boolean(text));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.insights.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.insights.subtitle}</p>
      </div>

      {cards.length > 0 ? (
        <div className="flex flex-col gap-3">
          {cards.map((text) => (
            <Card key={text} className="border-border/70 shadow-none">
              <CardContent className="flex items-start gap-3 py-4">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <p className="text-sm">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}
