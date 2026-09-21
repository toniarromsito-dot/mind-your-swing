import { prisma } from "@/lib/prisma";
import { computePlayerStats, type PlayerRound } from "@/lib/player-stats";

/**
 * Tope de vueltas cargadas para las estadísticas — evita que un jugador con
 * un histórico muy largo dispare una consulta sin límite (ver auditoría de
 * Fase 9, riesgo de performance). 100 vueltas es más que suficiente para
 * cualquier estadística de esta fase; una vista "histórico completo" con
 * paginación/agregación en SQL queda para una fase de optimización futura.
 */
const DEFAULT_ROUNDS_LIMIT = 100;

/**
 * Vueltas completadas de UN jugador, en la forma mínima que necesita
 * `computePlayerStats` — a diferencia de `gameWithPlayersInclude`
 * (src/lib/data/games.ts), esta consulta:
 * - nunca carga los `scores`/`shots` de otros jugadores de la partida
 *   (`players: { where: { userId } }` en vez de todos);
 * - nunca carga `Shot` (palo/distancia) — ninguna estadística de esta fase
 *   lo necesita;
 * - selecciona solo los campos de `Hole`/`Score` que las estadísticas usan.
 * Siempre acotado a las partidas del propio `userId` — nunca acepta un
 * `gameId`/`playerId` ajeno, así que no hay forma de pedir estadísticas de
 * otro jugador desde aquí.
 */
export async function getPlayerRoundsForStats(userId: string, limit = DEFAULT_ROUNDS_LIMIT): Promise<PlayerRound[]> {
  const games = await prisma.game.findMany({
    where: { status: "COMPLETED", players: { some: { userId } } },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      course: true,
      date: true,
      totalHoles: true,
      holes: { orderBy: { number: "asc" }, select: { id: true, number: true, par: true, index: true } },
      players: {
        where: { userId },
        select: {
          handicapIndex: true,
          scores: { select: { holeId: true, strokes: true, putts: true } },
        },
      },
    },
  });

  return games.map((game) => {
    const me = game.players[0] ?? null; // where:{userId} arriba garantiza como mucho 1
    const scoreByHoleId = new Map((me?.scores ?? []).map((s) => [s.holeId, s]));

    return {
      gameId: game.id,
      course: game.course,
      date: game.date,
      totalHoles: game.totalHoles,
      handicapIndex: me?.handicapIndex ?? null,
      holes: game.holes.map((hole) => {
        const score = scoreByHoleId.get(hole.id);
        return {
          number: hole.number,
          par: hole.par,
          index: hole.index,
          strokes: score?.strokes ?? null,
          putts: score?.putts ?? null,
        };
      }),
    };
  });
}

/** Atajo para el caso común: cargar + agregar en un solo paso. */
export async function getPlayerStats(userId: string, limit = DEFAULT_ROUNDS_LIMIT) {
  const rounds = await getPlayerRoundsForStats(userId, limit);
  return computePlayerStats(rounds);
}
