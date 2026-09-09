import { prisma } from "@/lib/prisma";

const gameWithPlayersInclude = {
  players: { include: { user: { select: { id: true, name: true, image: true } }, scores: true } },
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
