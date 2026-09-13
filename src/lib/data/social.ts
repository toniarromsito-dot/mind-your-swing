import { prisma } from "@/lib/prisma";

export async function isFollowing(followerId: string, followingId: string) {
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });
  return Boolean(row);
}

export async function listFollowingIds(userId: string) {
  const rows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  return rows.map((r) => r.followingId);
}

export function countFollowers(userId: string) {
  return prisma.follow.count({ where: { followingId: userId } });
}

export function countFollowing(userId: string) {
  return prisma.follow.count({ where: { followerId: userId } });
}

const storyInclude = {
  user: { select: { id: true, name: true, image: true } },
  likes: { select: { userId: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, name: true, image: true } } },
  },
};

/**
 * Feed / Amigos / Club — 3 pestañas honestas, no 4: un "Feed" y un
 * "Global" idénticos sin un algoritmo real de relevancia solo duplicarían
 * la misma lista con otro nombre, así que no se construye esa cuarta
 * pestaña. "Club" depende de que el jugador tenga un PlayerProfile con
 * club relleno — si no lo tiene, la pestaña sale vacía en vez de
 * inventar compañeros de club.
 */
export async function listStoriesForFeed(scope: "feed" | "friends" | "club", viewerId: string) {
  if (scope === "feed") {
    return prisma.story.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: storyInclude });
  }

  if (scope === "friends") {
    const followingIds = await listFollowingIds(viewerId);
    return prisma.story.findMany({
      where: { userId: { in: [...followingIds, viewerId] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: storyInclude,
    });
  }

  const myProfile = await prisma.playerProfile.findUnique({ where: { userId: viewerId }, select: { club: true } });
  if (!myProfile?.club) return [];
  const clubmates = await prisma.playerProfile.findMany({
    where: { club: myProfile.club, userId: { not: null } },
    select: { userId: true },
  });
  const clubUserIds = clubmates.map((p) => p.userId).filter((id): id is string => id != null);
  if (clubUserIds.length === 0) return [];
  return prisma.story.findMany({
    where: { userId: { in: clubUserIds } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: storyInclude,
  });
}
