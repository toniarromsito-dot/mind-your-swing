"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Inscribirse es solo intención de participar — nunca crea ni toca un
 * PlayerProfile o TournamentResult (eso lo hace solo el futuro importador
 * de resultados reales, ver src/lib/data/players.ts). Una partida normal
 * y una inscripción a torneo siguen sin tocarse entre sí.
 */
export async function registerForTournament(tournamentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Torneo no encontrado");

  await prisma.tournamentRegistration.upsert({
    where: { tournamentId_userId: { tournamentId, userId: session.user.id } },
    update: {},
    create: { tournamentId, userId: session.user.id },
  });
  revalidatePath("/community/tournaments");
}

export async function unregisterFromTournament(tournamentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  await prisma.tournamentRegistration.deleteMany({
    where: { tournamentId, userId: session.user.id },
  });
  revalidatePath("/community/tournaments");
}
