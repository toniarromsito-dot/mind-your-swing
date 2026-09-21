import { prisma } from "@/lib/prisma";

const tournamentInclude = {
  // Solo participantes activos cuentan como "inscrito"/en el contador —
  // los CANCELLED/NO_SHOW/REMOVED siguen en la tabla pero no aquí.
  participants: {
    where: { status: "REGISTERED" as const },
    select: { playerProfile: { select: { userId: true } } },
  },
  results: {
    include: {
      participant: { include: { playerProfile: { select: { firstName: true, lastName: true } } } },
    },
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

/** "Mis torneos": donde el jugador tiene una participación activa, futuros o pasados. */
export function listMyTournaments(userId: string) {
  return prisma.tournament.findMany({
    where: { participants: { some: { status: "REGISTERED", playerProfile: { userId } } } },
    orderBy: { date: "desc" },
    include: tournamentInclude,
  });
}
