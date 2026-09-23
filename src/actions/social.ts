"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseFeature } from "@/lib/entitlements";
import { commentSchema } from "@/lib/validations";
import { getDictionary } from "@/lib/i18n/current-locale";

export async function followUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  if (session.user.id === targetUserId) throw new Error("No puedes seguirte a ti mismo");

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: session.user.id, followingId: targetUserId } },
    update: {},
    create: { followerId: session.user.id, followingId: targetUserId },
  });
  revalidatePath("/community");
}

export async function unfollowUser(targetUserId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  await prisma.follow.deleteMany({ where: { followerId: session.user.id, followingId: targetUserId } });
  revalidatePath("/community");
}

export async function toggleLike(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const existing = await prisma.like.findUnique({
    where: { storyId_userId: { storyId, userId: session.user.id } },
  });
  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { storyId, userId: session.user.id } });
  }
  revalidatePath("/community");
}

export async function addComment(storyId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  // Comunidad (Fase 11C): las respuestas/comentarios son Pro tanto para
  // leer como para publicar. Se comprueba ANTES de validar/tocar la base de
  // datos — la UI ya oculta el formulario para FREE (ver story-card.tsx),
  // pero esto es lo que de verdad lo impide si se llama directamente.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!canUseFeature(user, "COMMUNITY_REPLIES")) {
    const { t } = await getDictionary();
    throw new Error(t.community.commentsProRequired);
  }

  const parsed = commentSchema.safeParse({ content });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Comentario inválido");

  await prisma.comment.create({ data: { storyId, userId: session.user.id, content: parsed.data.content } });
  revalidatePath("/community");
}

export async function joinChallenge(challengeId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  await prisma.challengeParticipant.upsert({
    where: { challengeId_userId: { challengeId, userId: session.user.id } },
    update: {},
    create: { challengeId, userId: session.user.id },
  });
  revalidatePath("/community");
}

export async function deleteComment(commentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const comment = await prisma.comment.findFirst({ where: { id: commentId, userId: session.user.id } });
  if (!comment) throw new Error("Comentario no encontrado");

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath("/community");
}
