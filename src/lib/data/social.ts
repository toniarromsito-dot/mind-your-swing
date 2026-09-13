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
 * pestaña. "Club" depende de que el jugador tenga rellenado su
 * `User.club` autodeclarado — si no lo tiene, la pestaña sale vacía en
 * vez de inventar compañeros de club.
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

  const me = await prisma.user.findUnique({ where: { id: viewerId }, select: { club: true } });
  if (!me?.club) return [];
  return prisma.story.findMany({
    where: { user: { club: me.club } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: storyInclude,
  });
}
