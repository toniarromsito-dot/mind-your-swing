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
 * Todo / Amigos / Campos / Consejos — dos ejes ortogonales de filtro
 * colapsados en una sola barra: "Amigos" filtra por grafo social (a quién
 * sigues), "Campos"/"Consejos" filtran por la categoría real que el autor
 * eligió al publicar (Story.category) — nunca por texto adivinado. "Todo"
 * no filtra por categoría, para no duplicar "Campos"+"Consejos"+general
 * como una pestaña idéntica con otro nombre.
 */
export async function listStoriesForFeed(scope: "all" | "friends" | "campo" | "consejo", viewerId: string) {
  if (scope === "friends") {
    const followingIds = await listFollowingIds(viewerId);
    return prisma.story.findMany({
      where: { userId: { in: [...followingIds, viewerId] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: storyInclude,
    });
  }

  if (scope === "campo" || scope === "consejo") {
    return prisma.story.findMany({
      where: { category: scope === "campo" ? "CAMPO" : "CONSEJO" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: storyInclude,
    });
  }

  return prisma.story.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: storyInclude });
}

/**
 * "Reto del mes": un reto real por mes (mes actual en formato "YYYY-MM"),
 * creado la primera vez que alguien visita Comunidad ese mes si todavía
 * no existe uno — nunca varios retos activos a la vez, nunca datos de
 * progreso fabricados: el progreso mostrado es cuántos jugadores se han
 * unido de verdad frente al objetivo, no una mejora de hándicap simulada
 * (eso necesitaría trackear hándicap histórico por jugador, que no existe).
 */
function currentChallengeMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const DEFAULT_CHALLENGE_TARGET = 50;

export async function getCurrentChallenge() {
  const month = currentChallengeMonth();
  const existing = await prisma.communityChallenge.findUnique({
    where: { month },
    include: { _count: { select: { participants: true } } },
  });
  if (existing) return existing;

  const created = await prisma.communityChallenge
    .create({
      data: {
        month,
        title: "Reto del mes",
        description: "Juega al menos una vuelta este mes y súmate al reto de la comunidad.",
        targetParticipants: DEFAULT_CHALLENGE_TARGET,
      },
      include: { _count: { select: { participants: true } } },
    })
    // Otra petición concurrente pudo crearlo primero (unique en month): en ese caso, léelo.
    .catch(() =>
      prisma.communityChallenge.findUniqueOrThrow({
        where: { month },
        include: { _count: { select: { participants: true } } },
      })
    );
  return created;
}

export async function hasJoinedChallenge(challengeId: string, userId: string) {
  const row = await prisma.challengeParticipant.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
  });
  return Boolean(row);
}
