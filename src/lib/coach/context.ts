import { prisma } from "@/lib/prisma";
import { formatRelativeToPar, holesPlayed, relativeToPar } from "@/lib/golf";
import type { CoachContext, CoachPhase } from "./types";

const RECENT_MOOD_LIMIT = 5;
const HISTORY_ROUNDS_LIMIT = 5;

async function buildHistorySummary(userId: string, excludeRoundId: string): Promise<string | null> {
  const pastMoodEntries = await prisma.moodEntry.findMany({
    where: {
      userId,
      roundId: { not: excludeRoundId },
      mood: { in: ["FRUSTRADO", "NERVIOSO"] },
      holeId: { not: null },
    },
    include: { hole: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (pastMoodEntries.length < 2) return null;

  // Agrupa por par del hoyo y por si el resultado fue igual o peor que bogey.
  const byPar = new Map<number, number>();
  let badResultCount = 0;
  for (const entry of pastMoodEntries.slice(0, HISTORY_ROUNDS_LIMIT * 4)) {
    if (!entry.hole) continue;
    byPar.set(entry.hole.par, (byPar.get(entry.hole.par) ?? 0) + 1);
    if (entry.hole.strokes != null && entry.hole.strokes - entry.hole.par >= 1) {
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
  if (status === "COMPLETED") return "post_ronda";
  return hasCurrentHole ? "durante_ronda" : "pre_ronda";
}

export async function getCoachContext(params: {
  userId: string;
  roundId: string;
  holeId?: string | null;
}): Promise<CoachContext> {
  const { userId, roundId, holeId } = params;

  const round = await prisma.round.findFirstOrThrow({
    where: { id: roundId, userId },
    include: {
      user: true,
      holes: { orderBy: { number: "asc" } },
      moodEntries: {
        orderBy: { createdAt: "desc" },
        take: RECENT_MOOD_LIMIT,
        include: { hole: true },
      },
    },
  });

  const currentHole = holeId ? round.holes.find((h) => h.id === holeId) ?? null : null;

  const playedHoles = round.holes.filter((h) => h.strokes != null);
  const historySummary = await buildHistorySummary(userId, roundId);

  return {
    phase: derivePhase(round.status, Boolean(currentHole)),
    playerName: round.user.name ?? "jugador/a",
    tone: round.user.coachTone,
    language: round.user.language,
    round: {
      course: round.course,
      totalHoles: round.totalHoles,
      goal: round.goal,
    },
    currentHole: currentHole
      ? {
          number: currentHole.number,
          par: currentHole.par,
          distance: currentHole.distance,
          strokes: currentHole.strokes,
          putts: currentHole.putts,
        }
      : null,
    roundProgress:
      playedHoles.length > 0
        ? {
            holesPlayed: holesPlayed(round.holes),
            totalHoles: round.totalHoles,
            relativeToPar: formatRelativeToPar(relativeToPar(round.holes)),
          }
        : null,
    recentMood: round.moodEntries.map((m) => ({
      mood: m.mood,
      note: m.note,
      holeNumber: m.hole?.number ?? null,
    })),
    historySummary,
  };
}
