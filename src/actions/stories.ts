"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storySchema } from "@/lib/validations";

export type ActionState = { error?: string } | undefined;

export async function createStory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  const parsed = storySchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.story.create({
    data: { userId: session.user.id, ...parsed.data },
  });

  revalidatePath("/community");
  return undefined;
}

export async function deleteStory(storyId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const story = await prisma.story.findFirst({
    where: { id: storyId, userId: session.user.id },
  });
  if (!story) throw new Error("Historia no encontrada");

  await prisma.story.delete({ where: { id: storyId } });
  revalidatePath("/community");
}
