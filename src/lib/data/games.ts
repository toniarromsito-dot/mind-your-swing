import { prisma } from "@/lib/prisma";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
import { relativeToPar } from "@/lib/golf";

const gameWithPlayersInclude = {
  players: {
    include: {
      user: { select: { id: true, name: true, image: true, handicap: true } },
      scores: { include: { shots: { orderBy: { sequence: "asc" as const } } } },
    },
  },
  holes: { orderBy: { number: "asc" as const } },
  golfCourse: true,
};

export function getGameForPlayer(gameId: string, userId: string) {
  return prisma.game.findFirst({
    where: { id: gameId, players: { some: { userId } } },
    include: gameWithPlayersInclude,
  });
}

export function getGameByInviteCode(inviteCode: string) {
  return prisma.game.findUnique({
    where: { inviteCode },
    include: { players: { include: { user: { select: { id: true, name: true, image: true } } } } },
  });
}

export function getActiveGamesForUser(userId: string) {
  return prisma.game.findMany({
    where: { status: "IN_PROGRESS", players: { some: { userId } } },
    orderBy: { date: "desc" },
    include: gameWithPlayersInclude,
  });
}

/**
 * Resultado (relativo al par) de cada ronda completada del jugador en el
 * mes natural en curso y en el anterior — para "Tu juego este mes" del
 * Home (ver computeMonthlyScoringTrend en insights.ts). Se apoya en
 * Game.date, no en createdAt, para que el mes sea el de cuándo se jugó.
 */
export async function getMonthlyRelativeToPar(userId: string): Promise<{ current: number[]; previous: number[] }> {
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const games = await prisma.game.findMany({
    where: { status: "COMPLETED", players: { some: { userId } }, date: { gte: startOfPreviousMonth } },
    include: gameWithPlayersInclude,
  });

  const current: number[] = [];
  const previous: number[] = [];
  for (const game of games) {
    const myPlayer = game.players.find((p) => p.user.id === userId);
    if (!myPlayer) continue;

    const { scores } = toStandingsInput(game);
    const myHoles = scores
      .filter((s) => s.playerId === myPlayer.id)
      .map((s) => ({ number: s.holeNumber, par: s.par, strokes: s.strokes }));
    const relative = relativeToPar(myHoles);

    if (game.date >= startOfCurrentMonth) current.push(relative);
    else previous.push(relative);
  }

  return { current, previous };
}

/** Para la tarjeta "Última vuelta" del dashboard — la partida terminada más reciente del jugador. */
export function getLastCompletedGameForUser(userId: string) {
  return prisma.game.findFirst({
    where: { status: "COMPLETED", players: { some: { userId } } },
    orderBy: { date: "desc" },
    include: gameWithPlayersInclude,
  });
}

export function listGamesForUser(userId: string) {
  return prisma.game.findMany({
    where: { players: { some: { userId } } },
    orderBy: { date: "desc" },
    include: gameWithPlayersInclude,
  });
}

/** Mensajes privados del jugador con su compañero para esta partida (nunca los de otros jugadores). */
export function getMessagesForGame(gameId: string, userId: string) {
  return prisma.message.findMany({
    where: { gameId, userId },
    orderBy: { createdAt: "asc" },
  });
}

/** Chat de MIND fuera de cualquier partida activa. */
export function getStandaloneMessages(userId: string) {
  return prisma.message.findMany({
    where: { userId, gameId: null },
    orderBy: { createdAt: "asc" },
  });
}

export function listDemoCourses(query?: string) {
  return prisma.golfCourse.findMany({
    where: query ? { name: { contains: query, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    include: { holes: { orderBy: { number: "asc" } } },
  });
}

export function getCourseWithHoles(courseId: string) {
  return prisma.golfCourse.findUnique({
    where: { id: courseId },
    include: { holes: { orderBy: { number: "asc" } } },
  });
}

export type HeadToHead = {
  totalGamesTogether: number;
  /** Solo tiene sentido mostrarlo cuando son 2 jugadores — ver resumen page. */
  winsByUserId: Record<string, number>;
  lastWinnerUserId: string | null;
};

/**
 * Historial entre este grupo de jugadores (partidas ya completadas donde
 * todos ellos jugaron juntos). El ganador de cada partida pasada se
 * calcula con la misma lógica de stroke play de siempre — suficiente para
 * el "pique" post-partida, no pretende ser exacto para modos por equipos.
 */
export async function getHeadToHeadHistory(userIds: string[], excludeGameId: string): Promise<HeadToHead> {
  const games = await prisma.game.findMany({
    where: {
      id: { not: excludeGameId },
      status: "COMPLETED",
      AND: userIds.map((userId) => ({ players: { some: { userId } } })),
    },
    include: {
      players: { include: { user: { select: { id: true, name: true } }, scores: true } },
      holes: { orderBy: { number: "asc" } },
    },
    orderBy: { date: "desc" },
  });

  const winsByUserId: Record<string, number> = Object.fromEntries(userIds.map((id) => [id, 0]));
  let lastWinnerUserId: string | null = null;

  games.forEach((g, index) => {
    const { players, scores } = toStandingsInput(g);
    const standings = computeStrokeStandings(players, scores);
    const winnerPlayerId = standings[0]?.playerId;
    const winnerUserId = g.players.find((p) => p.id === winnerPlayerId)?.userId ?? null;
    if (winnerUserId && winnerUserId in winsByUserId) winsByUserId[winnerUserId] += 1;
    if (index === 0) lastWinnerUserId = winnerUserId;
  });

  return { totalGamesTogether: games.length, winsByUserId, lastWinnerUserId };
}
