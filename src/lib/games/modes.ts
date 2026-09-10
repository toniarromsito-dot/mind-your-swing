import type { GameMode } from "@prisma/client";

export type StandingsKind = "stroke" | "match" | "points" | "team-stroke" | "best-ball";

type ModeMeta = {
  standingsKind: StandingsKind;
  usesTeams: boolean;
  usesChallenges: boolean;
  allowedPlayerCounts: number[];
  /** Modo gratuito o de pago (ver spec: los modos básicos son siempre gratis). */
  pro: boolean;
};

export const GAME_MODE_META: Record<GameMode, ModeMeta> = {
  SOLO: { standingsKind: "stroke", usesTeams: false, usesChallenges: false, allowedPlayerCounts: [1], pro: false },
  STROKE_PLAY: { standingsKind: "stroke", usesTeams: false, usesChallenges: false, allowedPlayerCounts: [2, 3, 4], pro: false },
  MATCH_PLAY: { standingsKind: "match", usesTeams: false, usesChallenges: false, allowedPlayerCounts: [2], pro: false },
  DUEL: { standingsKind: "stroke", usesTeams: false, usesChallenges: true, allowedPlayerCounts: [2], pro: true },
  FRIENDLY_CHALLENGE: { standingsKind: "stroke", usesTeams: false, usesChallenges: true, allowedPlayerCounts: [2, 3, 4], pro: true },
  EVERYONE_VS_EVERYONE: { standingsKind: "stroke", usesTeams: false, usesChallenges: false, allowedPlayerCounts: [3], pro: false },
  POINTS: { standingsKind: "points", usesTeams: false, usesChallenges: false, allowedPlayerCounts: [3, 4], pro: false },
  TWO_VS_TWO: { standingsKind: "team-stroke", usesTeams: true, usesChallenges: false, allowedPlayerCounts: [4], pro: false },
  BEST_BALL: { standingsKind: "best-ball", usesTeams: true, usesChallenges: false, allowedPlayerCounts: [4], pro: true },
  SCRAMBLE: { standingsKind: "team-stroke", usesTeams: true, usesChallenges: false, allowedPlayerCounts: [4], pro: true },
  TEAM_DUEL: { standingsKind: "team-stroke", usesTeams: true, usesChallenges: false, allowedPlayerCounts: [4], pro: true },
};

/**
 * Modos ofrecidos al crear una partida, el primero es el recomendado.
 * Lista deliberadamente corta por diseño ("no hace falta crear 20
 * modalidades, la experiencia debe ser sencilla para cualquier edad") —
 * FRIENDLY_CHALLENGE y TEAM_DUEL existen en el schema por compatibilidad
 * con partidas antiguas, pero ya no se ofrecen al crear una nueva.
 */
const CURATED_MODES: Partial<Record<number, GameMode[]>> = {
  1: ["SOLO"],
  2: ["STROKE_PLAY", "MATCH_PLAY", "DUEL"],
  3: ["STROKE_PLAY", "EVERYONE_VS_EVERYONE", "POINTS"],
  4: ["STROKE_PLAY", "TWO_VS_TWO", "BEST_BALL", "SCRAMBLE"],
};

export function modesForPlayerCount(count: number): GameMode[] {
  return CURATED_MODES[count] ?? [];
}

export const CHALLENGE_KEYS = [
  "closest_to_pin",
  "fairway",
  "par_streak",
  "mental_reset",
  "best_putter",
] as const;
export type ChallengeKey = (typeof CHALLENGE_KEYS)[number];
