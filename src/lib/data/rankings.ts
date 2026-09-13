import { prisma } from "@/lib/prisma";
import { computeMentalScore } from "@/lib/mood";
import { listFollowingIds } from "@/lib/data/social";

const MENTAL_SAMPLE_SIZE = 14;

export type RankedPlayer = {
  id: string;
  name: string | null;
  image: string | null;
  club: string | null;
  handicap: number;
  roundsCompleted: number;
  mentalScore: number | null;
};

/**
 * Clasificación real por hándicap autodeclarado (User.handicap) — no por
 * PlayerProfile/HandicapEntry, que hoy solo los rellenaría un futuro
 * importador de resultados de torneos y por tanto están vacíos para
 * todos los jugadores. Un jugador sin hándicap declarado no aparece: no
 * hay un valor honesto por el que ordenarlo. Rendimiento mental se
 * muestra como dato de apoyo (mismo cálculo que Perfil/Insights), nunca
 * como criterio de orden.
 */
export async function listRankedPlayers(
  scope: "friends" | "club" | "global",
  viewerId: string
): Promise<RankedPlayer[]> {
  let userIds: string[] | undefined;

  if (scope === "friends") {
    const followingIds = await listFollowingIds(viewerId);
    userIds = [...followingIds, viewerId];
  } else if (scope === "club") {
    const me = await prisma.user.findUnique({ where: { id: viewerId }, select: { club: true } });
    if (!me?.club) return [];
    const clubmates = await prisma.user.findMany({ where: { club: me.club }, select: { id: true } });
    userIds = clubmates.map((u) => u.id);
  }

  const users = await prisma.user.findMany({
    where: { handicap: { not: null }, ...(userIds ? { id: { in: userIds } } : {}) },
    select: { id: true, name: true, image: true, club: true, handicap: true },
  });

  const players = await Promise.all(
    users.map(async (u) => {
      const [roundsCompleted, recentMoods] = await Promise.all([
        prisma.game.count({ where: { status: "COMPLETED", players: { some: { userId: u.id } } } }),
        prisma.moodEntry.findMany({
          where: { userId: u.id },
          orderBy: { createdAt: "desc" },
          take: MENTAL_SAMPLE_SIZE,
          select: { mood: true },
        }),
      ]);
      const player: RankedPlayer = {
        id: u.id,
        name: u.name,
        image: u.image,
        club: u.club,
        handicap: u.handicap!,
        roundsCompleted,
        mentalScore: computeMentalScore(recentMoods)?.score ?? null,
      };
      return player;
    })
  );

  return players.sort((a, b) => a.handicap - b.handicap);
}
