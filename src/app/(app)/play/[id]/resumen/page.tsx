import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/require-user";
import { getGameForPlayer } from "@/lib/data/games";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StandingsPanel } from "@/components/standings-panel";
import { MoodCheckin } from "@/components/mood-checkin";
import { toStandingsInput } from "@/lib/games/adapt";
import { holeResultLabel } from "@/lib/golf";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function GameSummaryPage({ params }: PageProps<"/play/[id]/resumen">) {
  const { id } = await params;
  const userId = await requireUserId();

  const game = await getGameForPlayer(id, userId);
  if (!game) notFound();

  const { t } = await getDictionary();
  const { players, scores } = toStandingsInput(game);

  const myPlayer = game.players.find((p) => p.user.id === userId)!;
  const myScoreByHole = new Map(myPlayer.scores.map((s) => [s.holeId, s]));
  const myPlayedHoles = game.holes
    .map((h) => ({ ...h, strokes: myScoreByHole.get(h.id)?.strokes ?? null }))
    .filter((h) => h.strokes != null);

  const bestHole = myPlayedHoles.length
    ? myPlayedHoles.reduce((a, b) => (b.strokes! - b.par < a.strokes! - a.par ? b : a))
    : null;
  const worstHole = myPlayedHoles.length
    ? myPlayedHoles.reduce((a, b) => (b.strokes! - b.par > a.strokes! - a.par ? b : a))
    : null;

  const challengeWins = await prisma.challengeWin.findMany({ where: { gameId: id } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">{game.course}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(game.date).toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <StandingsPanel mode={game.mode} players={players} scores={scores} totalHoles={game.totalHoles} t={t.standings} />

      {game.insight && (
        <Card className="border-primary/30 bg-secondary/40">
          <CardHeader>
            <CardTitle className="font-heading text-lg">{t.summary.fromCoach}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{game.insight}</p>
          </CardContent>
        </Card>
      )}

      {(bestHole || worstHole) && (
        <div className="grid grid-cols-2 gap-3">
          {bestHole && (
            <Card>
              <CardContent className="flex flex-col items-center py-5">
                <span className="text-xs text-muted-foreground">{t.summary.bestHole}</span>
                <span className="font-heading text-xl">{holeResultLabel(bestHole.par, bestHole.strokes!, t.golfResult)}</span>
                <span className="text-xs text-muted-foreground">{t.summary.holeLabel(bestHole.number, bestHole.par)}</span>
              </CardContent>
            </Card>
          )}
          {worstHole && (
            <Card>
              <CardContent className="flex flex-col items-center py-5">
                <span className="text-xs text-muted-foreground">{t.summary.worstHole}</span>
                <span className="font-heading text-xl">{holeResultLabel(worstHole.par, worstHole.strokes!, t.golfResult)}</span>
                <span className="text-xs text-muted-foreground">{t.summary.holeLabel(worstHole.number, worstHole.par)}</span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {challengeWins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.playGame.challengesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {challengeWins.map((w) => {
              const winner = players.find((p) => p.playerId === w.playerId);
              return (
                <p key={w.id} className="text-sm text-muted-foreground">
                  🏆 {winner?.name} — {t.playGame.challengeLabels[w.challengeKey as keyof typeof t.playGame.challengeLabels] ?? w.challengeKey}
                </p>
              );
            })}
          </CardContent>
        </Card>
      )}

      <MoodCheckin gameId={game.id} t={t.moodCheckin} moodLabels={t.mood} />

      <Link href="/play" className={buttonVariants({ variant: "outline" })}>
        {t.summary.viewHistory}
      </Link>
    </div>
  );
}
