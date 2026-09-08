"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateHoleSchema } from "@/lib/validations";

export async function updateHole(roundId: string, input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = updateHoleSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");

  const { holeId, ...fields } = parsed.data;

  // Verifica que el hoyo pertenece a una ronda del usuario autenticado.
  const hole = await prisma.hole.findFirst({
    where: { id: holeId, round: { id: roundId, userId: session.user.id } },
  });
  if (!hole) throw new Error("Hoyo no encontrado");

  await prisma.hole.update({
    where: { id: holeId },
    data: fields,
  });

  revalidatePath(`/rondas/${roundId}`);
}
