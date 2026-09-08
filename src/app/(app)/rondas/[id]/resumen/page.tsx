import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/require-user";
import { getRoundForUser } from "@/lib/data/rounds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MoodChart } from "@/components/mood-chart";
import { formatRelativeToPar, holeResultLabel, relativeToPar, totalStrokes } from "@/lib/golf";
import { moodTrend } from "@/lib/mood";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function RoundSummaryPage({ params }: PageProps<"/rondas/[id]/resumen">) {
  const { id } = await params;
  const userId = await requireUserId();

  const round = await getRoundForUser(id, userId);
  if (!round) notFound();

  const { t } = await getDictionary();

  const playedHoles = round.holes.filter((h) => h.strokes != null);
  const trend = moodTrend(round.moodEntries, {
    hole: t.summary.chartHole,
    checkin: t.summary.chartCheckin,
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">{round.course}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(round.date).toLocaleDateString(t.dateLocale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center py-5">
            <span className="text-2xl font-heading">{totalStrokes(round.holes)}</span>
            <span className="text-xs text-muted-foreground">{t.summary.strokes}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-5">
            <span className="text-2xl font-heading">
              {formatRelativeToPar(relativeToPar(round.holes))}
            </span>
            <span className="text-xs text-muted-foreground">{t.summary.vsPar}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-5">
            <span className="text-2xl font-heading">{playedHoles.length}</span>
            <span className="text-xs text-muted-foreground">{t.summary.holes}</span>
          </CardContent>
        </Card>
      </div>

      {round.insight && (
        <Card className="border-primary/30 bg-secondary/40">
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t.summary.fromCoach}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{round.insight}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.summary.moodEvolution}</CardTitle>
        </CardHeader>
        <CardContent>
          <MoodChart data={trend} emptyLabel={t.summary.noMoodData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.summary.holeByHole}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-border">
            {round.holes.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{t.summary.holeLabel(h.number, h.par)}</span>
                <span className="font-medium">
                  {h.strokes != null
                    ? `${h.strokes} · ${holeResultLabel(h.par, h.strokes, t.golfResult)}`
                    : t.summary.noResult}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Link href="/historial" className={buttonVariants({ variant: "outline" })}>
        {t.summary.viewHistory}
      </Link>
    </div>
  );
}
