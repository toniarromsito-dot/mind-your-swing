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
      results: { include: { tournament: true }, orderBy: { createdAt: "desc" } },
      handicapHistory: { orderBy: { recordedAt: "desc" } },
    },
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
  playerProfileId: string;
  position?: number | null;
  strokes?: number | null;
  stablefordPts?: number | null;
  resultLabel?: string | null;
  newHandicap?: number | null;
}) {
  const { tournamentId, playerProfileId, position, strokes, stablefordPts, resultLabel, newHandicap } = params;

  const result = await prisma.tournamentResult.create({
    data: {
      tournamentId,
      playerId: playerProfileId,
      position: position ?? undefined,
      strokes: strokes ?? undefined,
      stablefordPts: stablefordPts ?? undefined,
      resultLabel: resultLabel ?? undefined,
    },
  });

  if (newHandicap != null) {
    await prisma.$transaction([
      prisma.handicapEntry.create({
        data: { playerId: playerProfileId, handicap: newHandicap, source: `torneo:${tournamentId}` },
      }),
      prisma.playerProfile.update({ where: { id: playerProfileId }, data: { handicap: newHandicap } }),
    ]);
  }

  return result;
}
