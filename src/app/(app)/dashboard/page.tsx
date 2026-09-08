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

export default async function DashboardPage() {
  const userId = await requireUserId();
  const session = await auth();

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
          Hola, {session?.user.name?.split(" ")[0] ?? "jugador/a"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Respira. Un golpe a la vez.
        </p>
      </div>

      {activeRound ? (
        <Card className="border-primary/30 bg-secondary/40">
          <CardHeader>
            <CardTitle className="font-heading text-xl">Ronda en curso</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{activeRound.course}</p>
                <p className="text-sm text-muted-foreground">
                  {holesPlayed(activeRound.holes)}/{activeRound.totalHoles} hoyos ·{" "}
                  {formatRelativeToPar(relativeToPar(activeRound.holes))}
                </p>
              </div>
              <Link href={`/rondas/${activeRound.id}`} className={buttonVariants({ className: "gap-1.5" })}>
                Continuar <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted-foreground">No tienes ninguna ronda en curso.</p>
            <Link
              href="/rondas/nueva"
              className={buttonVariants({ size: "lg", className: "gap-2" })}
            >
              <PlusCircle className="size-4" />
              Nueva ronda
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Estado de ánimo reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {avgMood == null ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay check-ins registrados.
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {avgMood >= 1 ? MOOD_EMOJI.CONFIADO : avgMood >= 0 ? MOOD_EMOJI.TRANQUILO : MOOD_EMOJI.NERVIOSO}
                </span>
                <p className="text-sm text-muted-foreground">
                  Tendencia de tus últimos check-ins
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Rondas jugadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-heading">{rounds.filter((r) => r.status === "COMPLETED").length}</p>
          </CardContent>
        </Card>
      </div>

      {pastRounds.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-xl">Rondas recientes</h2>
            <Link href="/historial" className="text-sm text-primary hover:underline">
              Ver todas
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
                        {new Date(r.date).toLocaleDateString("es-ES", {
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
