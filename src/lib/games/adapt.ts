import type { StandingsHoleScore, StandingsPlayer } from "./standings";

type AdaptableGame = {
  holes: { id: string; number: number; par: number; index?: number | null }[];
  players: {
    id: string;
    team: "A" | "B" | null;
    user: { name: string | null };
    scores: { holeId: string; strokes: number | null }[];
  }[];
};

/** Traduce el shape de Prisma (Game + players + scores) a la entrada pura que espera standings.ts. */
export function toStandingsInput(game: AdaptableGame): {
  players: StandingsPlayer[];
  scores: StandingsHoleScore[];
} {
  const holeById = new Map(game.holes.map((h) => [h.id, h]));

  const players: StandingsPlayer[] = game.players.map((p) => ({
    playerId: p.id,
    name: p.user.name ?? "Jugador",
    team: p.team,
  }));

  const scores: StandingsHoleScore[] = game.players.flatMap((p) =>
    p.scores
      .map((s) => {
        const hole = holeById.get(s.holeId);
        if (!hole) return null;
        return { holeNumber: hole.number, par: hole.par, holeIndex: hole.index ?? null, playerId: p.id, strokes: s.strokes };
      })
      .filter((s): s is StandingsHoleScore => s !== null)
  );

  return { players, scores };
}
