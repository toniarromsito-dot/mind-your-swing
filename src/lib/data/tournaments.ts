import { prisma } from "@/lib/prisma";

const tournamentInclude = {
  registrations: { select: { userId: true } },
  results: {
    include: { player: { select: { firstName: true, lastName: true } } },
    orderBy: { position: "asc" as const },
  },
};

export function listUpcomingTournaments() {
  return prisma.tournament.findMany({
    where: { date: { gte: new Date() } },
    orderBy: { date: "asc" },
    include: tournamentInclude,
  });
}

export function listPastTournaments() {
  return prisma.tournament.findMany({
    where: { date: { lt: new Date() } },
    orderBy: { date: "desc" },
    include: tournamentInclude,
  });
}

/** "Mis torneos": donde el jugador está inscrito, futuros o pasados. */
export function listMyTournaments(userId: string) {
  return prisma.tournament.findMany({
    where: { registrations: { some: { userId } } },
    orderBy: { date: "desc" },
    include: tournamentInclude,
  });
}
