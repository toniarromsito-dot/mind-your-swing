import { prisma } from "@/lib/prisma";

/**
 * Identidad competitiva y torneos — deliberadamente separado de
 * src/actions/games.ts. Ninguna función de aquí se llama desde una
 * partida casual de Mind Your Swing: solo las usará la futura
 * integración de torneos (importador, panel de admin, API federativa,
 * etc.). Ver prisma/schema.prisma → PlayerProfile / Tournament /
 * TournamentResult / HandicapEntry para el porqué de esta separación.
 */

export function getPlayerProfileByUserId(userId: string) {
  return prisma.playerProfile.findUnique({
    where: { userId },
    include: {
      // TournamentResult ya no cuelga directamente de PlayerProfile (Fase A):
      // pasa por TournamentParticipant, que es quien tiene la identidad.
      participations: {
        include: { tournament: true, results: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
      handicapHistory: { orderBy: { recordedAt: "desc" } },
    },
  });
}

/**
 * Garantiza que exista un PlayerProfile vinculado a ESTE User, para el flujo
 * de autoinscripción a un torneo desde la propia cuenta de MYS — nunca usa
 * el matching débil por nombre+club de `findOrCreatePlayerProfile` (ese
 * fallback es solo para una futura importación externa; usarlo aquí podría
 * reclamar por error el perfil de otra persona con el mismo nombre). Si el
 * jugador no tiene nombre en su perfil, falla con un mensaje claro en vez
 * de inventar uno.
 */
export async function ensurePlayerProfileForUser(userId: string) {
  const existing = await prisma.playerProfile.findUnique({ where: { userId } });
  if (existing) return existing;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, club: true } });
  const name = user.name?.trim();
  if (!name) {
    throw new Error("Añade tu nombre en el perfil antes de inscribirte en un torneo.");
  }
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ");

  return prisma.playerProfile.create({
    data: { userId, firstName, lastName, club: user.club ?? undefined },
  });
}

/**
 * Busca un PlayerProfile existente o crea uno nuevo. Se llama SOLO desde
 * el (futuro) flujo de importación de torneos, nunca al crear una cuenta
 * ni al jugar una partida — un PlayerProfile solo existe si hay un
 * resultado de torneo real detrás.
 *
 * Emparejamiento: primero por userId (si ya sabemos qué cuenta de la app
 * es esta persona), si no por nombre+apellidos+club. Esa heurística NO es
 * una identificación fiable a largo plazo (dos jugadores pueden compartir
 * nombre) — es un punto de partida razonable hasta que haya un
 * identificador federativo real que emparejar. Una vez creado, el
 * `playerId` (PlayerProfile.id) es la identidad estable a partir de ahí.
 */
export async function findOrCreatePlayerProfile(params: {
  userId?: string | null;
  firstName: string;
  lastName: string;
  club?: string | null;
}) {
  const { userId, firstName, lastName, club } = params;

  if (userId) {
    const byUser = await prisma.playerProfile.findUnique({ where: { userId } });
    if (byUser) return byUser;
  }

  const byName = await prisma.playerProfile.findFirst({
    where: { firstName, lastName, club: club ?? undefined },
  });
  if (byName) return byName;

  return prisma.playerProfile.create({
    data: { userId: userId ?? undefined, firstName, lastName, club: club ?? undefined },
  });
}

/**
 * Única función que debe escribir historial competitivo. La llama el
 * (futuro) importador de torneos tras confirmar un resultado real — nunca
 * finishGame() ni ningún otro flujo de partida casual.
 */
export async function recordTournamentResult(params: {
  tournamentId: string;
  participantId: string;
  position?: number | null;
  strokes?: number | null;
  stablefordPts?: number | null;
  resultLabel?: string | null;
  newHandicap?: number | null;
}) {
  const { tournamentId, participantId, position, strokes, stablefordPts, resultLabel, newHandicap } = params;

  const result = await prisma.tournamentResult.create({
    data: {
      tournamentId,
      participantId,
      position: position ?? undefined,
      strokes: strokes ?? undefined,
      stablefordPts: stablefordPts ?? undefined,
      resultLabel: resultLabel ?? undefined,
    },
  });

  if (newHandicap != null) {
    const participant = await prisma.tournamentParticipant.findUniqueOrThrow({
      where: { id: participantId },
      select: { playerProfileId: true },
    });
    await prisma.$transaction([
      prisma.handicapEntry.create({
        data: { playerId: participant.playerProfileId, handicap: newHandicap, source: `torneo:${tournamentId}` },
      }),
      prisma.playerProfile.update({ where: { id: participant.playerProfileId }, data: { handicap: newHandicap } }),
    ]);
  }

  return result;
}
