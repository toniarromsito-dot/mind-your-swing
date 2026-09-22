import type { CoachTone, GameMode, Mood } from "@prisma/client";
import type { RoundBreakdown } from "@/lib/golf";
import type { ConsistencyStat, CourseBreakdown, FormatBreakdown, HoleParBreakdown, ScoreBreakdown, ScoringTrend } from "@/lib/player-stats";

export type CoachPhase = "pre_partida" | "durante_partida" | "post_partida" | "standalone";

export type CoachMoodSnapshot = {
  mood: Mood;
  note: string | null;
  holeNumber: number | null;
};

/**
 * Proyección de `PlayerStats` (Fase 9, `src/lib/player-stats.ts`) para el
 * Coach — Fase 10. Nunca se recalcula ninguna cifra aquí: cada campo viene
 * literalmente de `computePlayerStats`, solo se seleccionan los campos
 * necesarios y se quitan los `gameId` (id interno, irrelevante para una
 * respuesta conversacional). Los mínimos de muestra ya los aplica
 * player-stats.ts — un campo en `null` aquí significa "sin muestra
 * suficiente todavía", nunca "cero".
 */
export type CoachPlayerStats = {
  completedRounds: number;
  recentRound: { course: string; date: Date; totalHoles: number } | null;
  bestRound: { course: string; date: Date; relativeToPar: number } | null;
  worstRound: { course: string; date: Date; relativeToPar: number } | null;
  averageStrokesPerHole: number | null;
  averageRelativeToPar: number | null;
  consistency: ConsistencyStat | null;
  trend: ScoringTrend | null;
  breakdown: ScoreBreakdown;
  byCourse: CourseBreakdown[];
  byHolePar: HoleParBreakdown[];
  byFormat: FormatBreakdown[];
};

export type CoachContext = {
  phase: CoachPhase;
  playerName: string;
  tone: CoachTone;
  language: string;
  /**
   * Handicap actual declarado por el jugador (`User.handicap`) — nunca el
   * hándicap oficial WHS/federado, que esta app no calcula. `null` si el
   * jugador no lo ha declarado.
   */
  playerHandicap: number | null;
  /** null cuando el jugador habla con su compañero fuera de una partida activa (ver /coach). */
  game: {
    course: string;
    totalHoles: number;
    goal: string | null;
    mode: GameMode;
    /** Playing Handicap del jugador para ESTA partida (foto congelada en GamePlayer), null si no está disponible. */
    playingHandicap: number | null;
  } | null;
  currentHole?: {
    number: number;
    par: number;
    distance: number | null;
    strokes: number | null;
    putts: number | null;
    /** Stroke Index del hoyo (1-18), null si la partida no tiene esa plantilla. */
    index: number | null;
    /** Golpes de hándicap que recibe el jugador en este hoyo — vía `strokesReceivedOnHole`, null si falta playingHandicap o index. */
    strokesReceived: number | null;
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
  /**
   * Señal real de uso de Aprende: cuántos análisis de swing (IA Swing) ha
   * hecho el jugador y la puntuación del más reciente. No hay progreso de
   * vídeos/ejercicios que trackear todavía, así que solo se rellena esto
   * — nunca se inventa un "progreso de Aprende" que no existe.
   */
  swingAnalysis: { count: number; latestScore: number | null } | null;
  /** Estadísticas históricas reales del jugador (Fase 10) — siempre presente, con `completedRounds: 0` si todavía no ha terminado ninguna vuelta. Nunca se recalcula: viene de `getPlayerStats` (Fase 9). */
  playerStats: CoachPlayerStats;
};
