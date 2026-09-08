import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getActiveRoundForUser, listRoundsForUser } from "@/lib/data/rounds";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeToPar, holesPlayed, relativeToPar } from "@/lib/golf";
import { MOOD_EMOJI, averageMoodScore } from "@/lib/mood";
import { PlusCircle, ArrowRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();

  const [activeRound, rounds, recentMoods] = await Promise.all([
    getActiveRoundForUser(userId),
    listRoundsForUser(userId),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const pastRounds = rounds.filter((r) => r.status === "COMPLETED").slice(0, 3);
  const avgMood = averageMoodScore(recentMoods);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl">
          {t.dashboard.greeting(session?.user.name?.split(" ")[0] ?? "")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.tagline}</p>
      </div>

      {activeRound ? (
        <Card className="border-primary/30 bg-secondary/40">
          <CardHeader>
            <CardTitle className="font-heading text-xl">{t.dashboard.roundInProgress}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{activeRound.course}</p>
                <p className="text-sm text-muted-foreground">
                  {t.dashboard.holesShort(holesPlayed(activeRound.holes), activeRound.totalHoles)} ·{" "}
                  {formatRelativeToPar(relativeToPar(activeRound.holes))}
                </p>
              </div>
              <Link href={`/rondas/${activeRound.id}`} className={buttonVariants({ className: "gap-1.5" })}>
                {t.dashboard.continue} <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted-foreground">{t.dashboard.noActiveRound}</p>
            <Link
              href="/rondas/nueva"
              className={buttonVariants({ size: "lg", className: "gap-2" })}
            >
              <PlusCircle className="size-4" />
              {t.dashboard.newRound}
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              {t.dashboard.recentMood}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {avgMood == null ? (
              <p className="text-sm text-muted-foreground">{t.dashboard.noCheckins}</p>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {avgMood >= 1 ? MOOD_EMOJI.CONFIADO : avgMood >= 0 ? MOOD_EMOJI.TRANQUILO : MOOD_EMOJI.NERVIOSO}
                </span>
                <p className="text-sm text-muted-foreground">{t.dashboard.moodTrend}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">{t.dashboard.roundsPlayed}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading">{rounds.filter((r) => r.status === "COMPLETED").length}</p>
          </CardContent>
        </Card>
      </div>

      {pastRounds.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-xl">{t.dashboard.recentRounds}</h2>
            <Link href="/historial" className="text-sm text-primary hover:underline">
              {t.dashboard.viewAll}
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {pastRounds.map((r) => (
              <Link key={r.id} href={`/rondas/${r.id}/resumen`}>
                <Card className="transition-colors hover:bg-secondary/40">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">{r.course}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(r.date).toLocaleDateString(t.dateLocale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="font-heading text-lg">
                      {formatRelativeToPar(relativeToPar(r.holes))}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
