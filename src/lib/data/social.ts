import type { Prisma } from "@prisma/client";
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

const authorSelect = { select: { id: true, name: true, image: true } } as const;

export type StoryComment = {
  id: string;
  content: string;
  createdAt: Date;
  userId: string;
  user: { id: string; name: string | null; image: string | null };
};

/**
 * `items: null` cuando el viewer no tiene acceso Pro — Comunidad (Fase 11C):
 * FREE puede publicar y leer posts, pero no respuestas/comentarios. El
 * `count` sí se muestra como incentivo ("8 respuestas · Ver con PRO"), pero
 * el CONTENIDO de las respuestas nunca se consulta a la base de datos para
 * un viewer FREE — no es "se pide todo y React lo oculta", la fila de
 * `Comment` ni siquiera se trae del `SELECT` en ese caso (ver
 * fetchStoriesWithComments más abajo).
 */
export type StoryComments = { count: number; items: StoryComment[] | null };

export type StoryWithSocial = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  userId: string;
  user: { id: string; name: string | null; image: string | null };
  likes: { userId: string }[];
  comments: StoryComments;
};

async function fetchStoriesWithComments(
  where: Prisma.StoryWhereInput,
  viewerHasProAccess: boolean
): Promise<StoryWithSocial[]> {
  if (viewerHasProAccess) {
    const stories = await prisma.story.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: authorSelect,
        likes: { select: { userId: true } },
        comments: { orderBy: { createdAt: "asc" }, include: { user: authorSelect } },
      },
    });
    return stories.map((s) => ({ ...s, comments: { count: s.comments.length, items: s.comments } }));
  }

  // Consulta distinta a propósito: para un viewer FREE, `Comment.content`
  // (y el autor de cada respuesta) NUNCA se selecciona de Postgres. Solo se
  // pide el recuento.
  const stories = await prisma.story.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: authorSelect,
      likes: { select: { userId: true } },
      _count: { select: { comments: true } },
    },
  });
  return stories.map((s) => ({ ...s, comments: { count: s._count.comments, items: null } }));
}

/**
 * Todo / Amigos / Campos / Consejos — dos ejes ortogonales de filtro
 * colapsados en una sola barra: "Amigos" filtra por grafo social (a quién
 * sigues), "Campos"/"Consejos" filtran por la categoría real que el autor
 * eligió al publicar (Story.category) — nunca por texto adivinado. "Todo"
 * no filtra por categoría, para no duplicar "Campos"+"Consejos"+general
 * como una pestaña idéntica con otro nombre.
 */
export async function listStoriesForFeed(
  scope: "all" | "friends" | "campo" | "consejo",
  viewerId: string,
  viewerHasProAccess: boolean
) {
  if (scope === "friends") {
    const followingIds = await listFollowingIds(viewerId);
    return fetchStoriesWithComments({ userId: { in: [...followingIds, viewerId] } }, viewerHasProAccess);
  }

  if (scope === "campo" || scope === "consejo") {
    return fetchStoriesWithComments({ category: scope === "campo" ? "CAMPO" : "CONSEJO" }, viewerHasProAccess);
  }

  return fetchStoriesWithComments({}, viewerHasProAccess);
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
