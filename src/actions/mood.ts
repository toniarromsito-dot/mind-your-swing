"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moodEntrySchema } from "@/lib/validations";

export async function createMoodEntry(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = moodEntrySchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const { gameId, holeId, mood, note } = parsed.data;

  if (gameId) {
    const player = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
    if (!player) throw new Error("No perteneces a esta partida");
  }

  await prisma.moodEntry.create({
    data: {
      userId: session.user.id,
      gameId: gameId ?? null,
      holeId: holeId ?? null,
      mood,
      note: note || null,
    },
  });

  revalidatePath(gameId ? `/play/${gameId}` : "/mind");
}
