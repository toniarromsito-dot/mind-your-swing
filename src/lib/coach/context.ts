import { prisma } from "@/lib/prisma";
import { computeRoundBreakdown, formatRelativeToPar, holesPlayed, relativeToPar } from "@/lib/golf";
import type { CoachContext, CoachPhase } from "./types";

const RECENT_MOOD_LIMIT = 5;
const HISTORY_ENTRIES_LIMIT = 20;

/**
 * Busca un patrón simple en el historial de ánimo del jugador (no solo de
 * la partida actual): "sueles frustrarte en hoyos par X" o "sueles
 * frustrarte tras un resultado peor que el par". Es lo que hace que el
 * compañero se sienta consistente en el tiempo, no un chat sin memoria.
 */
async function buildHistorySummary(userId: string, excludeGameId?: string): Promise<string | null> {
  const pastMoodEntries = await prisma.moodEntry.findMany({
    where: {
      userId,
      ...(excludeGameId ? { gameId: { not: excludeGameId } } : {}),
      mood: { in: ["FRUSTRADO", "NERVIOSO"] },
      holeId: { not: null },
    },
    include: { hole: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (pastMoodEntries.length < 2) return null;

  const myPlayers = await prisma.gamePlayer.findMany({ where: { userId }, select: { id: true } });
  const myPlayerIds = myPlayers.map((p) => p.id);
  const holeIds = pastMoodEntries.map((e) => e.holeId).filter((id): id is string => id != null);
  const scores =
    holeIds.length > 0
      ? await prisma.score.findMany({ where: { holeId: { in: holeIds }, playerId: { in: myPlayerIds } } })
      : [];
  const scoreByHole = new Map(scores.map((s) => [s.holeId, s]));

  const byPar = new Map<number, number>();
  let badResultCount = 0;
  for (const entry of pastMoodEntries.slice(0, HISTORY_ENTRIES_LIMIT)) {
    if (!entry.hole) continue;
    byPar.set(entry.hole.par, (byPar.get(entry.hole.par) ?? 0) + 1);
    const score = scoreByHole.get(entry.hole.id);
    if (score?.strokes != null && score.strokes - entry.hole.par >= 1) {
      badResultCount += 1;
    }
  }

  const [mostCommonPar, parCount] = [...byPar.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (mostCommonPar && parCount >= 2) {
    return `Suele registrar nerviosismo o frustración tras hoyos par ${mostCommonPar}, especialmente cuando el resultado es peor que el par.`;
  }
  if (badResultCount >= 2) {
    return `Suele registrar nerviosismo o frustración después de hoyos con resultado por encima del par.`;
  }
  return null;
}

function derivePhase(status: "IN_PROGRESS" | "COMPLETED", hasCurrentHole: boolean): CoachPhase {
  if (status === "COMPLETED") return "post_partida";
  return hasCurrentHole ? "durante_partida" : "pre_partida";
}

/**
 * Construye el contexto que ve el compañero de IA. gameId es opcional:
 * MIND funciona también fuera de una partida activa (fase "standalone").
 * Cuando hay partida, cada jugador solo ve SU PROPIA experiencia (sus
 * propios golpes) — el chat con el compañero es personal, no compartido
 * con el resto del grupo (ver spec: "the AI should NOT replace the
 * friends").
 */
export async function getCoachContext(params: {
  userId: string;
  gameId?: string | null;
  holeId?: string | null;
}): Promise<CoachContext> {
  const { userId, gameId, holeId } = params;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const recentMoodEntries = await prisma.moodEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: RECENT_MOOD_LIMIT,
    include: { hole: true },
  });
  const recentMood = recentMoodEntries.map((m) => ({
    mood: m.mood,
    note: m.note,
    holeNumber: m.hole?.number ?? null,
  }));

  const historySummary = await buildHistorySummary(userId, gameId ?? undefined);

  const mindMemory = user.plan === "PRO" ? (user.mindMemory ?? null) : null;

  if (!gameId) {
    return {
      phase: "standalone",
      playerName: user.name ?? "jugador/a",
      tone: user.coachTone,
      language: user.language,
      game: null,
      currentHole: null,
      gameProgress: null,
      recentMood,
      historySummary,
      mindMemory,
    };
  }

  const myPlayer = await prisma.gamePlayer.findFirstOrThrow({
    where: { gameId, userId },
    include: {
      game: { include: { holes: { orderBy: { number: "asc" } } } },
      scores: true,
    },
  });

  const holesWithMyScore = myPlayer.game.holes.map((h) => ({
    ...h,
    myScore: myPlayer.scores.find((s) => s.holeId === h.id) ?? null,
  }));
  const currentHole = holeId ? holesWithMyScore.find((h) => h.id === holeId) ?? null : null;
  const forGolfHelpers = holesWithMyScore.map((h) => ({
    number: h.number,
    par: h.par,
    strokes: h.myScore?.strokes ?? null,
  }));
  const playedHoles = forGolfHelpers.filter((h) => h.strokes != null);
  const phase = derivePhase(myPlayer.game.status, Boolean(currentHole));

  return {
    phase,
    playerName: user.name ?? "jugador/a",
    tone: user.coachTone,
    language: user.language,
    game: {
      course: myPlayer.game.course,
      totalHoles: myPlayer.game.totalHoles,
      goal: myPlayer.game.goal,
      mode: myPlayer.game.mode,
    },
    currentHole: currentHole
      ? {
          number: currentHole.number,
          par: currentHole.par,
          distance: currentHole.distance,
          strokes: currentHole.myScore?.strokes ?? null,
          putts: currentHole.myScore?.putts ?? null,
        }
      : null,
    gameProgress:
      playedHoles.length > 0
        ? {
            holesPlayed: holesPlayed(forGolfHelpers),
            totalHoles: myPlayer.game.totalHoles,
            relativeToPar: formatRelativeToPar(relativeToPar(forGolfHelpers)),
          }
        : null,
    roundBreakdown: phase === "post_partida" ? computeRoundBreakdown(forGolfHelpers) : null,
    recentMood,
    historySummary,
    mindMemory,
  };
}
