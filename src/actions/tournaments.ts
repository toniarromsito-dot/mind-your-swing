"use server";

import { revalidatePath } from "next/cache";
import type { TournamentParticipantStatus, TournamentStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensurePlayerProfileForUser } from "@/lib/data/players";
import { isValidParticipantTransition, isValidTournamentTransition } from "@/lib/tournaments/lifecycle";
import { canManageTournament } from "@/lib/tournaments/permissions";

async function requireSessionUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");
  return { id: session.user.id, email: session.user.email };
}

async function requireTournamentManager(tournamentId: string) {
  const user = await requireSessionUser();
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Torneo no encontrado");
  if (!canManageTournament(tournament, user)) {
    throw new Error("No tienes permiso para gestionar este torneo");
  }
  return { user, tournament };
}

/**
 * Autoinscribirse: solo cuando el torneo está abierto a inscripción — un
 * torneo IN_PROGRESS (típicamente llegado ya en marcha desde una gestión
 * externa) se accede por el flujo de identificación/claim, no por aquí. No
 * crea un TournamentResult (eso lo hace solo el futuro cierre del torneo,
 * ver src/lib/data/players.ts). Identifica al jugador consigo mismo
 * (PLAYER_CONFIRMED): no es una heurística de nombre, es su propia cuenta
 * iniciando sesión.
 */
export async function registerForTournament(tournamentId: string) {
  const user = await requireSessionUser();

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("Torneo no encontrado");
  if (tournament.status !== "REGISTRATION_OPEN") {
    throw new Error("Este torneo no está abierto a inscripción");
  }

  const playerProfile = await ensurePlayerProfileForUser(user.id);

  const existing = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_playerProfileId: { tournamentId, playerProfileId: playerProfile.id } },
  });

  if (existing && (existing.status === "NO_SHOW" || existing.status === "REMOVED")) {
    throw new Error("No puedes volver a inscribirte por tu cuenta; contacta con el organizador del torneo");
  }

  if (existing) {
    if (existing.status !== "REGISTERED") {
      await prisma.tournamentParticipant.update({ where: { id: existing.id }, data: { status: "REGISTERED" } });
    }
  } else {
    await prisma.tournamentParticipant.create({
      data: {
        tournamentId,
        playerProfileId: playerProfile.id,
        status: "REGISTERED",
        identityConfidence: "PLAYER_CONFIRMED",
      },
    });
  }
  revalidatePath("/community/tournaments");
}

/**
 * Cancela la inscripción — actualiza el estado a CANCELLED en vez de borrar
 * la fila: TournamentParticipant es el registro oficial de participación, no
 * solo una intención efímera. Solo actúa sobre una fila que esté REGISTERED
 * para no pisar un NO_SHOW/REMOVED ya decidido por el organizer.
 */
export async function unregisterFromTournament(tournamentId: string) {
  const user = await requireSessionUser();

  const playerProfile = await prisma.playerProfile.findUnique({ where: { userId: user.id } });
  if (!playerProfile) return; // nunca se inscribió, nada que cancelar

  await prisma.tournamentParticipant.updateMany({
    where: { tournamentId, playerProfileId: playerProfile.id, status: "REGISTERED" },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/community/tournaments");
}

/**
 * Cambia el estado del torneo — solo el organizer o un platform admin, y
 * solo dentro de las transiciones válidas (ver lifecycle.ts). DRAFT/FINISHED/
 * CANCELLED no se gestionan desde el autoservicio del jugador en ningún caso.
 */
export async function updateTournamentStatus(tournamentId: string, newStatus: TournamentStatus) {
  const { tournament } = await requireTournamentManager(tournamentId);

  if (!isValidTournamentTransition(tournament.status, newStatus)) {
    throw new Error(`No se puede pasar de ${tournament.status} a ${newStatus}`);
  }

  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: newStatus } });
  revalidatePath("/community/tournaments");
}

/**
 * Carga un participante oficial (organizer/admin) — nunca hace matching
 * automático por nombre+club: si se pasa `playerProfileId`, es porque el
 * organizer ya eligió explícitamente un PlayerProfile existente (p. ej. de
 * una lista de candidatos sugeridos); si no, se crea un PlayerProfile nuevo
 * sin ningún User vinculado todavía. El participante nace siempre UNVERIFIED
 * — el vínculo con una cuenta real llega solo por claimParticipant.
 */
export async function addParticipant(
  tournamentId: string,
  input: {
    firstName: string;
    lastName: string;
    club?: string | null;
    category?: string | null;
    externalParticipantId?: string | null;
    playerProfileId?: string | null;
  }
) {
  await requireTournamentManager(tournamentId);

  const playerProfileId = input.playerProfileId
    ? (await prisma.playerProfile.findUniqueOrThrow({ where: { id: input.playerProfileId } })).id
    : (
        await prisma.playerProfile.create({
          data: { firstName: input.firstName, lastName: input.lastName, club: input.club ?? undefined },
        })
      ).id;

  const existing = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_playerProfileId: { tournamentId, playerProfileId } },
  });
  if (existing) throw new Error("Este jugador ya es participante de este torneo");

  const participant = await prisma.tournamentParticipant.create({
    data: {
      tournamentId,
      playerProfileId,
      status: "REGISTERED",
      identityConfidence: "UNVERIFIED",
      category: input.category ?? undefined,
      externalParticipantId: input.externalParticipantId ?? undefined,
    },
  });
  revalidatePath("/community/tournaments");
  return participant;
}

/**
 * Cambia el estado de un participante concreto (organizer/admin) — p. ej.
 * marcar NO_SHOW tras el torneo, o REMOVED por un registro duplicado.
 * Distinto del autoservicio del jugador (registerForTournament/
 * unregisterFromTournament), que tiene sus propias reglas más estrictas.
 */
export async function setParticipantStatus(participantId: string, newStatus: TournamentParticipantStatus) {
  const participant = await prisma.tournamentParticipant.findUniqueOrThrow({
    where: { id: participantId },
    include: { tournament: true },
  });
  const user = await requireSessionUser();
  if (!canManageTournament(participant.tournament, user)) {
    throw new Error("No tienes permiso para gestionar este torneo");
  }

  if (!isValidParticipantTransition(participant.status, newStatus)) {
    throw new Error(`No se puede pasar de ${participant.status} a ${newStatus}`);
  }

  await prisma.tournamentParticipant.update({ where: { id: participantId }, data: { status: newStatus } });
  revalidatePath("/community/tournaments");
}

/**
 * "Este participante eres tú": el propio jugador confirma su identidad
 * sobre un participante cargado por el organizer (UNVERIFIED, sin User
 * vinculado). Nunca promociona a LICENSE_VERIFIED — eso queda reservado a
 * una validación externa futura. Respeta el invariante de PlayerProfile.userId
 * único: si el jugador ya tiene su propio PlayerProfile, no puede reclamar
 * uno distinto.
 */
export async function claimParticipant(participantId: string) {
  const user = await requireSessionUser();

  const participant = await prisma.tournamentParticipant.findUniqueOrThrow({
    where: { id: participantId },
    include: { playerProfile: true },
  });

  if (participant.status !== "REGISTERED") {
    throw new Error("Este participante no está activo en el torneo");
  }

  if (participant.playerProfile.userId === user.id) {
    await prisma.tournamentParticipant.update({
      where: { id: participantId },
      data: { identityConfidence: "PLAYER_CONFIRMED", matchedByUserId: user.id, matchedAt: new Date() },
    });
    revalidatePath("/community/tournaments");
    return;
  }

  if (participant.playerProfile.userId) {
    throw new Error("Este participante ya está vinculado a otra cuenta");
  }

  const ownProfile = await prisma.playerProfile.findUnique({ where: { userId: user.id } });
  if (ownProfile && ownProfile.id !== participant.playerProfileId) {
    throw new Error("Ya tienes un perfil de jugador vinculado a tu cuenta; no puedes reclamar otro participante");
  }

  await prisma.$transaction([
    prisma.playerProfile.update({ where: { id: participant.playerProfileId }, data: { userId: user.id } }),
    prisma.tournamentParticipant.update({
      where: { id: participantId },
      data: { identityConfidence: "PLAYER_CONFIRMED", matchedByUserId: user.id, matchedAt: new Date() },
    }),
  ]);
  revalidatePath("/community/tournaments");
}

/**
 * Corrige a qué PlayerProfile apunta un participante (organizer/admin) —
 * desvincular/re-vincular la identidad. Resetea identityConfidence a
 * UNVERIFIED: el vínculo anterior (PLAYER_CONFIRMED o LICENSE_VERIFIED) era
 * sobre OTRO PlayerProfile, no sobre el nuevo. No toca PlayerProfile.userId
 * de ningún perfil — solo corrige a cuál apunta este participante.
 */
export async function rematchParticipant(participantId: string, newPlayerProfileId: string) {
  const participant = await prisma.tournamentParticipant.findUniqueOrThrow({
    where: { id: participantId },
    include: { tournament: true },
  });
  const user = await requireSessionUser();
  if (!canManageTournament(participant.tournament, user)) {
    throw new Error("No tienes permiso para gestionar este torneo");
  }

  await prisma.playerProfile.findUniqueOrThrow({ where: { id: newPlayerProfileId } });

  const conflict = await prisma.tournamentParticipant.findUnique({
    where: {
      tournamentId_playerProfileId: { tournamentId: participant.tournamentId, playerProfileId: newPlayerProfileId },
    },
  });
  if (conflict && conflict.id !== participantId) {
    throw new Error("Ese perfil ya es participante de este torneo");
  }

  await prisma.tournamentParticipant.update({
    where: { id: participantId },
    data: {
      playerProfileId: newPlayerProfileId,
      identityConfidence: "UNVERIFIED",
      matchedByUserId: user.id,
      matchedAt: new Date(),
    },
  });
  revalidatePath("/community/tournaments");
}
