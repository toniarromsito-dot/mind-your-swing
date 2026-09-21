"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensurePlayerProfileForUser } from "@/lib/data/players";

/**
 * Autoinscribirse: crea (o reactiva) el TournamentParticipant de la propia
 * cuenta del jugador — nunca crea un TournamentResult (eso lo hace solo el
 * futuro cierre del torneo, ver src/lib/data/players.ts). Identifica al
 * jugador consigo mismo (PLAYER_CONFIRMED): no es una heurística de nombre,
 * es su propia cuenta iniciando sesión.
 */
export async function registerForTournament(tournamentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Torneo no encontrado");

  const playerProfile = await ensurePlayerProfileForUser(session.user.id);

  await prisma.tournamentParticipant.upsert({
    where: { tournamentId_playerProfileId: { tournamentId, playerProfileId: playerProfile.id } },
    update: { status: "REGISTERED" },
    create: {
      tournamentId,
      playerProfileId: playerProfile.id,
      status: "REGISTERED",
      identityConfidence: "PLAYER_CONFIRMED",
    },
  });
  revalidatePath("/community/tournaments");
}

/**
 * Cancela la inscripción — actualiza el estado a CANCELLED en vez de borrar
 * la fila: TournamentParticipant es el registro oficial de participación, no
 * solo una intención efímera (a diferencia del antiguo TournamentRegistration).
 */
export async function unregisterFromTournament(tournamentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const playerProfile = await prisma.playerProfile.findUnique({ where: { userId: session.user.id } });
  if (!playerProfile) return; // nunca se inscribió, nada que cancelar

  await prisma.tournamentParticipant.updateMany({
    where: { tournamentId, playerProfileId: playerProfile.id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/community/tournaments");
}
