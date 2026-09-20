import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy, RotateCcw } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { getGameForPlayer, getHeadToHeadHistory } from "@/lib/data/games";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { MoodCheckin } from "@/components/mood-checkin";
import { MindInsightReveal } from "@/components/mind-insight-reveal";
import { DetailsDrawer } from "@/components/details-drawer";
import { toStandingsInput } from "@/lib/games/adapt";
import { GAME_MODE_META } from "@/lib/games/modes";
import {
  computeBestBallStandings,
  computeNetStrokeStandings,
  computeStrokeStandings,
  computeTeamStrokeStandings,
} from "@/lib/games/standings";
import { holeResultLabel } from "@/lib/golf";
import { gamePlayingHandicapForIndex } from "@/lib/games/handicap";
import { createRematch } from "@/actions/games";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

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
  // Playing Handicap CONGELADO al incorporarse a la partida
  // (GamePlayer.playingHandicap) — fuente de verdad. Solo se recalcula en
  // vivo como fallback para GamePlayer creados antes de esta foto por
  // jugador (filas legacy con el campo null).
  const handicapsByPlayerId = Object.fromEntries(
    game.players.map((p) => [p.id, p.playingHandicap ?? gamePlayingHandicapForIndex(game, p.user.handicap)])
  );
  const netStandings = usesTeams ? [] : computeNetStrokeStandings(players, scores, handicapsByPlayerId);
  const netByPlayerId = new Map(netStandings.map((s) => [s.playerId, s]));

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

  const myStanding = individualStandings.find((s) => s.playerId === myPlayer.id);
  const myNet = netByPlayerId.get(myPlayer.id);
  const holesPlayedCount = myPlayedHoles.length;
  const playedFewerHoles = holesPlayedCount > 0 && holesPlayedCount < game.totalHoles;

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <div className="relative flex h-[22vh] min-h-[170px] shrink-0 flex-col items-center justify-center overflow-hidden px-6 pt-[env(safe-area-inset-top)] text-center">
        <Image
          src="/images/play-hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_70%]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/25 to-black/50" />
        <div className="relative flex flex-col items-center gap-1">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Trophy className="size-5 text-white" />
          </span>
          <p className="font-heading text-2xl font-bold text-white">{t.summary.roundFinished}</p>
          <p className="text-xs font-medium text-white/85">{game.course}</p>
          <p className="text-[11px] text-white/75">
            {playedFewerHoles
              ? fmt(t.summary.holesPlayedPartial, { played: holesPlayedCount, total: game.totalHoles })
              : fmt(t.summary.holesTotal, { total: game.totalHoles })}
            {" · "}
            {new Date(game.date).toLocaleDateString(t.dateLocale, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-t-3xl bg-background px-4 pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      {myStanding && (
        <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-3xl border border-border/70 bg-card px-5 py-3.5 text-center shadow-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{t.summary.strokes}</p>
          <p className="flex items-baseline gap-2 font-heading text-4xl font-semibold tracking-tight">
            {myStanding.total}
            <span className="text-lg font-medium text-muted-foreground">{myStanding.relativeToPar}</span>
          </p>
          {myNet && (
            <p className="text-xs text-muted-foreground">
              {t.summary.grossLabel} {myStanding.total} · {t.summary.netLabel} {myNet.net}
            </p>
          )}
        </div>
      )}

      {usesTeams && winnerTeam && loserTeam ? (
        <Card className="shrink-0 border-primary/40">
          <CardContent className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span>{t.standings.team} A</span>
              <span>{t.summary.vsLabel}</span>
              <span>{t.standings.team} B</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-primary" />
              <p className="font-heading text-2xl">
                {t.standings.team} {winnerTeam.team}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{winnerTeam.playerNames.join(" + ")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shrink-0 border-primary/40">
          <CardContent className="flex flex-col items-center gap-2 py-3.5">
            <Trophy className="size-5 text-primary" />
            <div className="flex w-full max-w-xs flex-col gap-1.5">
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
                  <span className="flex items-baseline gap-1.5">
                    <span className={i === 0 ? "font-heading font-semibold" : "text-muted-foreground"}>{s.total}</span>
                    {netByPlayerId.get(s.playerId) && (
                      <span className={cn("text-xs", i === 0 ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                        ({t.summary.netLabel.toLowerCase()} {netByPlayerId.get(s.playerId)!.net})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apuesta, insight de Mind, mejor/peor hoyo, historial cara-a-cara y
          check-in de humor: todo secundario vive detrás de un toque, no
          apilado en la pantalla principal — el insight de Mind puede ser
          largo (texto generado), así que no puede vivir en una pantalla que
          tiene que caber siempre en un tamaño fijo sin scroll. */}
      <DetailsDrawer label={t.summary.viewDetails}>
        {game.bet && (loserPlayer || loserTeam) && (
          <p className="text-center text-sm">
            {fmt(t.summary.betLoserTemplate, {
              name: usesTeams ? loserTeam!.playerNames.join(" y ") : loserPlayer!.name,
              bet: game.bet,
            })}
          </p>
        )}

        {game.insight && (
          <MindInsightReveal
            insight={game.insight}
            t={{ reviewPrompt: t.summary.reviewPrompt, reviewButton: t.summary.reviewButton, fromCoach: t.summary.fromCoach }}
          />
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

        <MoodCheckin gameId={game.id} t={t.moodCheckin} moodLabels={t.mood} />
      </DetailsDrawer>

      <div className="min-h-0 flex-1" />

      <div className="flex shrink-0 gap-3">
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
    </div>
  );
}
