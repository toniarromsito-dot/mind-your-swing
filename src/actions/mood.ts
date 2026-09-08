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

  const { roundId, holeId, mood, note } = parsed.data;

  const round = await prisma.round.findFirst({
    where: { id: roundId, userId: session.user.id },
  });
  if (!round) throw new Error("Ronda no encontrada");

  await prisma.moodEntry.create({
    data: {
      userId: session.user.id,
      roundId,
      holeId: holeId ?? null,
      mood,
      note: note || null,
    },
  });

  revalidatePath(`/rondas/${roundId}`);
}
