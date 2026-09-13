import { formatRelativeToPar, relativeToPar, totalStrokes } from "@/lib/golf";
import { computeNetResult } from "@/lib/games/handicap";

/**
 * Cálculo de clasificaciones para cada modo de juego. Funciones puras
 * (sin Prisma) para poder testearlas igual que golf.ts/scoring.ts — las
 * páginas/acciones se encargan de traducir filas de Score a estas formas.
 */

export type StandingsPlayer = {
  playerId: string;
  name: string;
  team: "A" | "B" | null;
};

export type StandingsHoleScore = {
  holeNumber: number;
  par: number;
  /** Stroke Index del hoyo (1-18); null si el campo no tiene ese dato (partida sin plantilla de campo). */
  holeIndex: number | null;
  playerId: string;
  strokes: number | null;
};

export type StrokeStanding = {
  playerId: string;
  name: string;
  team: "A" | "B" | null;
  total: number;
  relativeToPar: string;
  holesPlayed: number;
};

function playerHoles(scores: StandingsHoleScore[], playerId: string) {
  return scores
    .filter((s) => s.playerId === playerId)
    .map((s) => ({ number: s.holeNumber, par: s.par, strokes: s.strokes }));
}

/** Stroke play / everyone-vs-everyone / solo: total de golpes, menor gana. */
export function computeStrokeStandings(
  players: StandingsPlayer[],
  scores: StandingsHoleScore[]
): StrokeStanding[] {
  return players
    .map((p) => {
      const holes = playerHoles(scores, p.playerId);
      return {
        playerId: p.playerId,
        name: p.name,
        team: p.team,
        total: totalStrokes(holes),
        relativeToPar: formatRelativeToPar(relativeToPar(holes)),
        holesPlayed: holes.filter((h) => h.strokes != null).length,
      };
    })
    .sort((a, b) => a.total - b.total);
}

export type NetStrokeStanding = {
  playerId: string;
  net: number;
  netRelativeToPar: string;
};

/**
 * Resultado neto (bruto - golpes de hándicap recibidos) por jugador, solo
 * para quienes tienen hándicap declarado Y al menos un hoyo jugado con
 * Stroke Index conocido — si falta cualquiera de los dos, ese jugador
 * simplemente no aparece en el resultado en vez de mostrar un neto
 * fabricado. Ver `computeNetResult` en `handicap.ts` para la simplificación
 * documentada del cálculo (usa el hándicap declarado tal cual).
 */
export function computeNetStrokeStandings(
  players: StandingsPlayer[],
  scores: StandingsHoleScore[],
  handicapsByPlayerId: Record<string, number | null | undefined>
): NetStrokeStanding[] {
  const results: NetStrokeStanding[] = [];
  for (const p of players) {
    const holes = scores
      .filter((s) => s.playerId === p.playerId)
      .map((s) => ({ par: s.par, index: s.holeIndex, strokes: s.strokes }));
    const net = computeNetResult(holes, handicapsByPlayerId[p.playerId] ?? null);
    if (!net) continue;
    results.push({
      playerId: p.playerId,
      net: net.net,
      netRelativeToPar: formatRelativeToPar(net.net - net.parPlayed),
    });
  }
  return results.sort((a, b) => a.net - b.net);
}

export type MatchPlayStanding = {
  leaderPlayerId: string | null;
  leaderName: string | null;
  holesUp: number;
  holesRemaining: number;
  summary: string;
};

/** Match play (2 jugadores): tanteo hoyo a hoyo, "Antonio 1 UP". */
export function computeMatchPlayStandings(
  players: [StandingsPlayer, StandingsPlayer],
  scores: StandingsHoleScore[],
  totalHoles: number
): MatchPlayStanding {
  const [a, b] = players;
  let diff = 0; // positivo = a va ganando
  let holesDecided = 0;

  const holeNumbers = [...new Set(scores.map((s) => s.holeNumber))].sort((x, y) => x - y);
  for (const number of holeNumbers) {
    const aScore = scores.find((s) => s.holeNumber === number && s.playerId === a.playerId)?.strokes;
    const bScore = scores.find((s) => s.holeNumber === number && s.playerId === b.playerId)?.strokes;
    if (aScore == null || bScore == null) continue;
    holesDecided += 1;
    if (aScore < bScore) diff += 1;
    else if (bScore < aScore) diff -= 1;
  }

  const holesRemaining = totalHoles - holesDecided;
  if (diff === 0) {
    return { leaderPlayerId: null, leaderName: null, holesUp: 0, holesRemaining, summary: "AS" };
  }
  const leader = diff > 0 ? a : b;
  const holesUp = Math.abs(diff);
  return {
    leaderPlayerId: leader.playerId,
    leaderName: leader.name,
    holesUp,
    holesRemaining,
    summary: `${leader.name} ${holesUp} UP`,
  };
}

export type PointsStanding = { playerId: string; name: string; team: "A" | "B" | null; points: number };

function stablefordPoints(par: number, strokes: number): number {
  const diff = strokes - par;
  if (diff <= -3) return 5;
  if (diff === -2) return 4;
  if (diff === -1) return 3;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
}

/** Puntos (modo "Points"): puntos estilo Stableford por hoyo, sumados. */
export function computePointsStandings(
  players: StandingsPlayer[],
  scores: StandingsHoleScore[]
): PointsStanding[] {
  return players
    .map((p) => {
      const holes = playerHoles(scores, p.playerId);
      const points = holes.reduce(
        (sum, h) => sum + (h.strokes != null ? stablefordPoints(h.par, h.strokes) : 0),
        0
      );
      return { playerId: p.playerId, name: p.name, team: p.team, points };
    })
    .sort((a, b) => b.points - a.points);
}

export type TeamStanding = { team: "A" | "B"; total: number; relativeToPar: string; playerNames: string[] };

/** 2 vs 2 / Team Duel / Scramble: suma de golpes del equipo (en scramble solo hay una fila de Score por hoyo). */
export function computeTeamStrokeStandings(
  players: StandingsPlayer[],
  scores: StandingsHoleScore[]
): TeamStanding[] {
  const teams: Array<"A" | "B"> = ["A", "B"];
  return teams.map((team) => {
    const teamPlayers = players.filter((p) => p.team === team);
    const holes = teamPlayers.flatMap((p) => playerHoles(scores, p.playerId));
    return {
      team,
      total: totalStrokes(holes),
      relativeToPar: formatRelativeToPar(relativeToPar(holes)),
      playerNames: teamPlayers.map((p) => p.name),
    };
  });
}

/** Best ball: por hoyo, el resultado del equipo es el mejor (menor) de sus dos jugadores. */
export function computeBestBallStandings(players: StandingsPlayer[], scores: StandingsHoleScore[]): TeamStanding[] {
  const teams: Array<"A" | "B"> = ["A", "B"];
  const holeNumbers = [...new Set(scores.map((s) => s.holeNumber))].sort((x, y) => x - y);

  return teams.map((team) => {
    const teamPlayerIds = players.filter((p) => p.team === team).map((p) => p.playerId);
    let total = 0;
    let relTotal = 0;

    for (const number of holeNumbers) {
      const holeScores = scores.filter((s) => s.holeNumber === number && teamPlayerIds.includes(s.playerId));
      const withStrokes = holeScores.filter((s) => s.strokes != null);
      if (withStrokes.length === 0) continue;
      const best = Math.min(...withStrokes.map((s) => s.strokes!));
      const par = holeScores[0].par;
      total += best;
      relTotal += best - par;
    }

    return {
      team,
      total,
      relativeToPar: formatRelativeToPar(relTotal),
      playerNames: players.filter((p) => p.team === team).map((p) => p.name),
    };
  });
}

export type ChallengeTally = { playerId: string; name: string; wins: number };

/** Tanteo de mini-retos ganados (Duel / Friendly Challenge), marcados manualmente durante la partida. */
export function computeChallengeTally(
  players: StandingsPlayer[],
  wins: { playerId: string; challengeKey: string }[]
): ChallengeTally[] {
  return players
    .map((p) => ({
      playerId: p.playerId,
      name: p.name,
      wins: wins.filter((w) => w.playerId === p.playerId).length,
    }))
    .sort((a, b) => b.wins - a.wins);
}
