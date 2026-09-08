import { prisma } from "@/lib/prisma";

export function getRoundForUser(roundId: string, userId: string) {
  return prisma.round.findFirst({
    where: { id: roundId, userId },
    include: {
      holes: { orderBy: { number: "asc" } },
      moodEntries: { orderBy: { createdAt: "asc" }, include: { hole: true } },
    },
  });
}

export function getActiveRoundForUser(userId: string) {
  return prisma.round.findFirst({
    where: { userId, status: "IN_PROGRESS" },
    orderBy: { date: "desc" },
    include: { holes: { orderBy: { number: "asc" } } },
  });
}

export function listRoundsForUser(userId: string) {
  return prisma.round.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    include: { holes: true },
  });
}

export function getMessagesForRound(roundId: string) {
  return prisma.message.findMany({
    where: { roundId },
    orderBy: { createdAt: "asc" },
  });
}
