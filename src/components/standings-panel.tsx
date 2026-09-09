import type { GameMode } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { GAME_MODE_META } from "@/lib/games/modes";
import {
  computeBestBallStandings,
  computeMatchPlayStandings,
  computePointsStandings,
  computeStrokeStandings,
  computeTeamStrokeStandings,
  type StandingsHoleScore,
  type StandingsPlayer,
} from "@/lib/games/standings";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function StandingsPanel({
  mode,
  players,
  scores,
  totalHoles,
  t,
}: {
  mode: GameMode;
  players: StandingsPlayer[];
  scores: StandingsHoleScore[];
  totalHoles: number;
  t: Dictionary["standings"];
}) {
  const kind = GAME_MODE_META[mode].standingsKind;

  if (kind === "match" && players.length === 2) {
    const result = computeMatchPlayStandings([players[0], players[1]], scores, totalHoles);
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-1 py-6 text-center">
          <p className="font-heading text-2xl">{result.summary}</p>
          <p className="text-sm text-muted-foreground">
            {t.holesRemaining}: {result.holesRemaining}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (kind === "points") {
    const result = computePointsStandings(players, scores);
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          {result.map((r, i) => (
            <div key={r.playerId} className="flex items-center justify-between text-sm">
              <span className={i === 0 ? "font-medium" : "text-muted-foreground"}>{r.name}</span>
              <span className="font-heading text-lg">{r.points} pts</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (kind === "team-stroke" || kind === "best-ball") {
    const result = kind === "best-ball" ? computeBestBallStandings(players, scores) : computeTeamStrokeStandings(players, scores);
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          {result.map((r) => (
            <div key={r.team} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{t.team} {r.team}</p>
                <p className="text-xs text-muted-foreground">{r.playerNames.join(" · ")}</p>
              </div>
              <span className="font-heading text-lg">{r.relativeToPar}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // stroke play / everyone-vs-everyone / solo / duel / friendly challenge
  const result = computeStrokeStandings(players, scores);
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        {result.map((r, i) => (
          <div key={r.playerId} className="flex items-center justify-between text-sm">
            <span className={i === 0 ? "font-medium" : "text-muted-foreground"}>{r.name}</span>
            <span className="font-heading text-lg">{r.relativeToPar}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
