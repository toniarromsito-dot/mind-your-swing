import type { TournamentParticipantStatus, TournamentStatus } from "@prisma/client";

/**
 * Transiciones explícitas — Fase B. Terminal (FINISHED/CANCELLED) no tiene
 * salida: cerrar/cancelar un torneo no se deshace desde aquí.
 */
const VALID_TOURNAMENT_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  DRAFT: ["REGISTRATION_OPEN", "CANCELLED"],
  REGISTRATION_OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["FINISHED", "CANCELLED"],
  FINISHED: [],
  CANCELLED: [],
};

export function isValidTournamentTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  return VALID_TOURNAMENT_TRANSITIONS[from].includes(to);
}

/**
 * Transiciones que puede aplicar un organizer/admin sobre un participante —
 * distinto del camino de autoservicio del propio jugador (registerForTournament
 * / unregisterFromTournament), que tiene sus propias reglas más estrictas.
 * REMOVED -> REGISTERED existe para poder deshacer una eliminación por error.
 */
const VALID_PARTICIPANT_TRANSITIONS: Record<TournamentParticipantStatus, TournamentParticipantStatus[]> = {
  REGISTERED: ["CANCELLED", "NO_SHOW", "REMOVED"],
  CANCELLED: ["REGISTERED", "REMOVED"],
  NO_SHOW: ["REGISTERED", "REMOVED"],
  REMOVED: ["REGISTERED"],
};

export function isValidParticipantTransition(
  from: TournamentParticipantStatus,
  to: TournamentParticipantStatus
): boolean {
  return VALID_PARTICIPANT_TRANSITIONS[from].includes(to);
}
