import { prisma } from "@/lib/prisma";
import type { RecoveryEvent } from "@/lib/insights";

const MOOD_SAMPLE_SIZE = 30;
const RECOVERY_SAMPLE_SIZE = 50;

/**
 * Últimos check-ins de ánimo del jugador — misma fuente que "Tu juego
 * mental" (computeMentalScore) y que la gráfica de tendencia de
 * Insights (moodTrend), de más reciente a más antiguo.
 */
export function getMentalTrendData(userId: string) {
  return prisma.moodEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MOOD_SAMPLE_SIZE,
    select: { mood: true, hole: { select: { number: true } } },
  });
}

/**
 * Para cada check-in de NERVIOSO/FRUSTRADO ligado a un hoyo, mira el
 * resultado del hoyo SIGUIENTE de esa misma partida: "recuperado" si
 * salió a la par o mejor. Se descartan los check-ins del último hoyo de
 * la partida (no hay "siguiente" que mirar) y los que no tienen todavía
 * resultado registrado — nunca se inventa si se recuperó o no.
 */
export async function getRecoveryEvents(userId: string): Promise<RecoveryEvent[]> {
  const badMoments = await prisma.moodEntry.findMany({
    where: { userId, mood: { in: ["FRUSTRADO", "NERVIOSO"] }, holeId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: RECOVERY_SAMPLE_SIZE,
    include: { hole: { include: { game: { include: { holes: { orderBy: { number: "asc" } } } } } } },
  });
  if (badMoments.length === 0) return [];

  const myPlayerIds = (await prisma.gamePlayer.findMany({ where: { userId }, select: { id: true } })).map((p) => p.id);
  if (myPlayerIds.length === 0) return [];

  const events: RecoveryEvent[] = [];
  for (const moment of badMoments) {
    const hole = moment.hole;
    if (!hole) continue;
    const nextHole = hole.game.holes.find((h) => h.number === hole.number + 1);
    if (!nextHole) continue;

    const nextScore = await prisma.score.findFirst({
      where: { holeId: nextHole.id, playerId: { in: myPlayerIds } },
      select: { strokes: true },
    });
    if (!nextScore || nextScore.strokes == null) continue;

    events.push({ recovered: nextScore.strokes <= nextHole.par });
  }
  return events;
}

/**
 * Separa los check-ins de ánimo ligados a un hoyo en "últimos 6 hoyos de
 * la partida" vs "el resto", usando el total de hoyos de cada partida
 * (9 o 18) para que "últimos 6" sea relativo, no un número de hoyo fijo.
 */
export async function getPressureByHoleRange(userId: string) {
  const entries = await prisma.moodEntry.findMany({
    where: { userId, holeId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: RECOVERY_SAMPLE_SIZE,
    include: { hole: { include: { game: { select: { totalHoles: true } } } } },
  });

  const close: { mood: (typeof entries)[number]["mood"] }[] = [];
  const rest: { mood: (typeof entries)[number]["mood"] }[] = [];
  for (const entry of entries) {
    if (!entry.hole) continue;
    const group = entry.hole.number > entry.hole.game.totalHoles - 6 ? close : rest;
    group.push({ mood: entry.mood });
  }
  return { close, rest };
}
