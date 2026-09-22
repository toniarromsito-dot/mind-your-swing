/**
 * Modelo local de una partida activa — Offline-First de Jugar. Guarda solo
 * lo que el scorecard necesita para funcionar sin red (audit: Game/Hole[]/
 * GamePlayer[]/Score.strokes/Score.putts/Game.started/Game.status), nunca
 * una copia genérica de Prisma. `Shot` (palo/distancia) queda fuera a
 * propósito — decisión aprobada, iteración futura.
 */

export type LocalHole = {
  id: string;
  number: number;
  par: number;
  distance: number | null;
  index: number | null;
};

export type LocalPlayer = {
  /** GamePlayer.id — el id real que usan saveHoleScores/las Score. */
  id: string;
  userId: string;
  name: string;
  image: string | null;
  /** Playing Handicap ya congelado en GamePlayer, si lo hay. */
  playingHandicap: number | null;
  /** User.handicap — fallback para partidas/jugadores anteriores a la foto por jugador (mismo criterio que GameView hoy). */
  userHandicap: number | null;
};

export type ScoreSyncStatus = "synced" | "pending" | "error";

export type LocalScoreEntry = {
  strokes: number | null;
  putts: number | null;
  syncStatus: ScoreSyncStatus;
  /** epoch ms — última escritura LOCAL de este dato, para reconciliar contra lo que traiga el servidor. */
  updatedAt: number;
  /** Solo cuando syncStatus === "error": por qué no se reintenta más (401/403/validación). */
  errorReason?: string;
};

/** Clave compuesta `${holeId}:${playerId}` — mismo grano que `@@unique([holeId, playerId])` en Score. */
export type ScoreKey = string;

export function scoreKey(holeId: string, playerId: string): ScoreKey {
  return `${holeId}:${playerId}`;
}

export type LocalGameStatus =
  /** Vuelta en marcha, jugándose. */
  | "active"
  /** finishGame se pidió (offline u online) pero el servidor no lo ha confirmado todavía. */
  | "completed_pending_sync"
  /** El servidor confirmó Game.status = COMPLETED. */
  | "completed_synced";

/**
 * El "Game" completo que necesita Jugar, en la forma mínima local — no las
 * ~30 columnas de Prisma, solo lo que GameView/SharedScorecard leen hoy
 * (ver game-view.tsx: teeCourseRating/teeSlope/teeParTotal/teeHoleCount/
 * handicapAllowance, necesarios para el motor de hándicap en vivo).
 */
export type LocalGame = {
  gameId: string;
  course: string;
  totalHoles: number;
  teeCourseRating: number | null;
  teeSlope: number | null;
  teeParTotal: number | null;
  teeHoleCount: number | null;
  handicapAllowance: number | null;
  holes: LocalHole[];
  players: LocalPlayer[];
  /** Score por (holeId,playerId) — nunca todo el array de Score de Prisma, solo strokes/putts + su estado de sync. */
  scores: Record<ScoreKey, LocalScoreEntry>;
  localStatus: LocalGameStatus;
  /** Estado de sincronización de la finalización — independiente del de cada Score. */
  finishSyncStatus: "idle" | "pending" | "synced" | "error";
  finishErrorReason?: string;
  /** Cuándo se guardó este snapshot localmente por última vez. */
  snapshotSavedAt: number;
  /** Último intento de sincronización (de cualquier tipo), para espaciar los reintentos. */
  lastSyncAttemptAt: number | null;
};

/** Estado agregado de sincronización que consume la UX discreta (Bloque 8). */
export type SyncUxStatus = "online" | "offline" | "syncing" | "synced" | "sync_error";
