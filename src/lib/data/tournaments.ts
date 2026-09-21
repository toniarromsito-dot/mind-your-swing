import { prisma } from "@/lib/prisma";

const tournamentInclude = {
  // Todos los estados del participante (Fase B): la UI decide qué contar
  // como "inscrito" (status REGISTERED) y qué mostrar en "Mis torneos"
  // (cualquier estado, para poder distinguirlos ahí).
  participants: {
    select: {
      status: true,
      category: true,
      playerProfile: { select: { userId: true } },
    },
  },
  results: {
    include: {
      participant: { include: { playerProfile: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { position: "asc" as const },
  },
};

/** Abiertos a inscripción o ya en marcha — nunca DRAFT/FINISHED/CANCELLED. */
export function listUpcomingTournaments() {
  return prisma.tournament.findMany({
    where: { status: { in: ["REGISTRATION_OPEN", "IN_PROGRESS"] } },
    orderBy: { date: "asc" },
    include: tournamentInclude,
  });
}

/** Cerrados — de aquí salen los resultados oficiales. */
export function listPastTournaments() {
  return prisma.tournament.findMany({
    where: { status: "FINISHED" },
    orderBy: { date: "desc" },
    include: tournamentInclude,
  });
}

/**
 * "Mis torneos": cualquier torneo donde el jugador tiene una participación,
 * sea cual sea su estado — el jugador debe poder ver que fue cancelado, no
 * se presentó o fue eliminado, no solo los que siguen REGISTERED.
 */
export function listMyTournaments(userId: string) {
  return prisma.tournament.findMany({
    where: { participants: { some: { playerProfile: { userId } } } },
    orderBy: { date: "desc" },
    include: tournamentInclude,
  });
}

/**
 * Candidatos para el flujo "¿Eres tú?": participantes cargados por el
 * organizer que todavía no están vinculados a ninguna cuenta — nunca se
 * enlazan aquí, solo se muestran para que el propio jugador los reclame
 * explícitamente (ver claimParticipant). Acotado al nombre del propio
 * `viewerUserId`: nunca expone la lista completa de no-verificados del
 * torneo a cualquier visitante, solo a quien plausiblemente puede ser esa
 * persona. Sin nombre en el perfil del visitante, no hay candidatos que
 * mostrar (no se puede acotar, así que no se muestra nada).
 */
export async function listClaimCandidates(tournamentId: string, viewerUserId: string) {
  const viewer = await prisma.user.findUnique({ where: { id: viewerUserId }, select: { name: true } });
  const name = viewer?.name?.trim();
  if (!name) return [];

  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ");

  return prisma.tournamentParticipant.findMany({
    where: {
      tournamentId,
      status: "REGISTERED",
      identityConfidence: "UNVERIFIED",
      playerProfile: {
        userId: null,
        OR: [
          { firstName: { equals: firstName, mode: "insensitive" } },
          ...(lastName ? [{ lastName: { equals: lastName, mode: "insensitive" as const } }] : []),
        ],
      },
    },
    select: {
      id: true,
      playerProfile: { select: { firstName: true, lastName: true, club: true } },
    },
  });
}
