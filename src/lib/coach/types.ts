import type { CoachTone, GameMode, Mood } from "@prisma/client";
import type { RoundBreakdown } from "@/lib/golf";

export type CoachPhase = "pre_partida" | "durante_partida" | "post_partida" | "standalone";

export type CoachMoodSnapshot = {
  mood: Mood;
  note: string | null;
  holeNumber: number | null;
};

export type CoachContext = {
  phase: CoachPhase;
  playerName: string;
  tone: CoachTone;
  language: string;
  /** null cuando el jugador habla con su compañero fuera de una partida activa (ver /mind). */
  game: {
    course: string;
    totalHoles: number;
    goal: string | null;
    mode: GameMode;
  } | null;
  currentHole?: {
    number: number;
    par: number;
    distance: number | null;
    strokes: number | null;
    putts: number | null;
  } | null;
  gameProgress?: {
    holesPlayed: number;
    totalHoles: number;
    relativeToPar: string;
  } | null;
  /** Solo relleno en post_partida: cifras reales para que Mind no invente el análisis. */
  roundBreakdown?: RoundBreakdown | null;
  recentMood: CoachMoodSnapshot[];
  historySummary: string | null;
  /** Memoria persistente de Mind entre partidas — solo para jugadores Pro (ver context.ts). */
  mindMemory: string | null;
};
