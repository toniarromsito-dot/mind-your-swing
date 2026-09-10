import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, RotateCcw } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { getGameForPlayer, getHeadToHeadHistory } from "@/lib/data/games";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { MoodCheckin } from "@/components/mood-checkin";
import { MindInsightReveal } from "@/components/mind-insight-reveal";
import { toStandingsInput } from "@/lib/games/adapt";
import { GAME_MODE_META } from "@/lib/games/modes";
import { computeBestBallStandings, computeStrokeStandings, computeTeamStrokeStandings } from "@/lib/games/standings";
import { holeResultLabel } from "@/lib/golf";
import { createRematch } from "@/actions/games";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";

export default async function GameSummaryPage({ params }: PageProps<"/play/[id]/resumen">) {
  const { id } = await params;
  const userId = await requireUserId();

  const game = await getGameForPlayer(id, userId);
  if (!game) notFound();

  const { t } = await getDictionary();
  const { players, scores } = toStandingsInput(game);
  const userIdByPlayerId = new Map(game.players.map((p) => [p.id, p.userId]));

  const kind = GAME_MODE_META[game.mode].standingsKind;
  const usesTeams = GAME_MODE_META[game.mode].usesTeams;

  const teamStandings =
    kind === "best-ball" ? computeBestBallStandings(players, scores) : computeTeamStrokeStandings(players, scores);
  const individualStandings = computeStrokeStandings(players, scores);

  const winnerTeam = usesTeams ? [...teamStandings].sort((a, b) => a.total - b.total)[0] : null;
  const winnerPlayer = !usesTeams ? individualStandings[0] : null;
  const loserPlayer = !usesTeams ? individualStandings[individualStandings.length - 1] : null;
  const loserTeam = usesTeams ? [...teamStandings].sort((a, b) => b.total - a.total)[0] : null;

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

  const otherPlayerIds = game.players.map((p) => p.userId);
  const headToHead =
    otherPlayerIds.length > 1 ? await getHeadToHeadHistory(otherPlayerIds, game.id) : null;
  const winnerUserId = winnerPlayer ? userIdByPlayerId.get(winnerPlayer.playerId) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {new Date(game.date).toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{game.course}</h1>
      </div>

      {usesTeams && winnerTeam && loserTeam ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span>{t.standings.team} A</span>
              <span>{t.summary.vsLabel}</span>
              <span>{t.standings.team} B</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="size-6 text-primary" />
              <p className="font-heading text-3xl">
                {t.standings.team} {winnerTeam.team}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{winnerTeam.playerNames.join(" + ")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-primary/40">
          <CardContent className="flex flex-col items-center gap-3 py-6">
            <Trophy className="size-7 text-primary" />
            <div className="flex w-full max-w-xs flex-col gap-2">
              {individualStandings.map((s, i) => (
                <div
                  key={s.playerId}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                    i === 0 ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex size-5 items-center justify-center rounded-full text-xs font-medium ${
                        i === 0 ? "bg-primary-foreground/20" : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={i === 0 ? "font-medium" : ""}>{s.name}</span>
                  </span>
                  <span className={i === 0 ? "font-heading font-semibold" : "text-muted-foreground"}>{s.total}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {game.bet && (loserPlayer || loserTeam) && (
        <p className="text-center text-sm">
          {fmt(t.summary.betLoserTemplate, {
            name: usesTeams ? loserTeam!.playerNames.join(" y ") : loserPlayer!.name,
            bet: game.bet,
          })}
        </p>
      )}

      {headToHead && headToHead.totalGamesTogether > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 text-center text-sm text-muted-foreground">
            <p>{fmt(t.summary.headToHeadTotal, { n: headToHead.totalGamesTogether })}</p>
            {game.players.length === 2 &&
              game.players.map((p) => (
                <p key={p.id}>
                  {fmt(t.summary.headToHeadWinsTemplate, {
                    name: p.user.name ?? "—",
                    wins: headToHead.winsByUserId[p.userId] ?? 0,
                  })}
                </p>
              ))}
            <p className="mt-1 font-medium text-foreground">
              {winnerUserId && headToHead.lastWinnerUserId === winnerUserId
                ? fmt(t.summary.rematchWonTemplate, { name: winnerPlayer?.name ?? "" })
                : t.summary.rematchPending}
            </p>
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

      {game.insight && <MindInsightReveal insight={game.insight} t={t.summary} />}

      <MoodCheckin gameId={game.id} t={t.moodCheckin} moodLabels={t.mood} />

      <div className="flex gap-3">
        <form action={createRematch.bind(null, game.id)} className="flex-1">
          <Button type="submit" variant="outline" className="w-full gap-2">
            <RotateCcw className="size-4" />
            {t.summary.rematchButton}
          </Button>
        </form>
        <Link href="/play" className={buttonVariants({ variant: "outline", className: "flex-1" })}>
          {t.summary.viewHistory}
        </Link>
      </div>
    </div>
  );
}
