import { scoreKey, type LocalGame, type LocalScoreEntry, type ScoreKey } from "./types";

/**
 * Forma mínima del `Game` tal como lo entrega el servidor (Server
 * Component) — ver GameForView en game-view.tsx. Función pura: nada de
 * Prisma ni Capacitor aquí, para poder testearla igual que golf.ts.
 */
export type ServerGameSnapshot = {
  id: string;
  course: string;
  totalHoles: number;
  teeCourseRating: number | null;
  teeSlope: number | null;
  teeParTotal: number | null;
  teeHoleCount: number | null;
  handicapAllowance: number | null;
  status: "IN_PROGRESS" | "COMPLETED";
  holes: { id: string; number: number; par: number; distance: number | null; index: number | null }[];
  players: {
    id: string;
    userId: string;
    name: string;
    image: string | null;
    playingHandicap: number | null;
    userHandicap: number | null;
    scores: { holeId: string; strokes: number | null; putts: number | null }[];
  }[];
};

/**
 * Combina los Score del servidor con los Score locales — regla única:
 * un Score local "pending" o "error" NUNCA se pisa silenciosamente por una
 * respuesta de servidor (que puede ser más antigua que la propia escritura
 * local, sobre todo justo después de reconectar). Un Score local "synced"
 * SÍ se deja ganar al servidor (por si otro dispositivo lo cambió — fuera
 * de alcance completo, pero no debe corromper el dato). Si un score existe
 * solo en un lado, gana ese lado.
 */
export function reconcileScores(
  serverPlayers: ServerGameSnapshot["players"],
  previousScores: Record<ScoreKey, LocalScoreEntry>,
  now: number
): Record<ScoreKey, LocalScoreEntry> {
  const merged: Record<ScoreKey, LocalScoreEntry> = {};

  for (const player of serverPlayers) {
    for (const s of player.scores) {
      if (s.strokes == null && s.putts == null) continue;
      const key = scoreKey(s.holeId, player.id);
      merged[key] = { strokes: s.strokes, putts: s.putts, syncStatus: "synced", updatedAt: now };
    }
  }

  for (const [key, local] of Object.entries(previousScores)) {
    if (local.syncStatus === "pending" || local.syncStatus === "error") {
      merged[key] = local; // el servidor todavía no ha visto este cambio — nunca se pierde
    }
    // Si estaba "synced" localmente y el servidor ya trae su propia versión
    // (ya escrita arriba), se deja ganar al servidor. Si estaba "synced" y
    // el servidor YA NO lo trae (no debería pasar salvo borrado externo),
    // no se reintroduce — el servidor manda para lo ya confirmado.
  }

  return merged;
}

/**
 * Construye el `LocalGame` a guardar tras cargar la página con datos
 * frescos del servidor, partiendo de un snapshot local previo si existía
 * (para no perder ningún score todavía pendiente de sincronizar). Es la
 * función que monta GameView en cada arranque/reconexión — ver
 * "Reconciliación", Bloque 4/9 del plan aprobado.
 */
export function buildLocalGameFromServer(
  server: ServerGameSnapshot,
  previous: LocalGame | null,
  now: number
): LocalGame {
  const scores = reconcileScores(server.players, previous?.scores ?? {}, now);

  // Si había una finalización local pendiente y el servidor YA confirma
  // COMPLETED, se considera sincronizada — nunca al revés (el servidor
  // nunca "des-completa" una partida localmente completada).
  let localStatus: LocalGame["localStatus"] = previous?.localStatus ?? "active";
  let finishSyncStatus: LocalGame["finishSyncStatus"] = previous?.finishSyncStatus ?? "idle";
  if (server.status === "COMPLETED") {
    localStatus = "completed_synced";
    finishSyncStatus = "synced";
  } else if (previous?.localStatus === "completed_pending_sync") {
    // El jugador ya pidió finalizar localmente pero el servidor aún la ve
    // IN_PROGRESS (todavía no ha sincronizado) — se respeta esa intención,
    // no se reabre la vuelta solo porque el servidor vaya con retraso.
    localStatus = "completed_pending_sync";
  }

  return {
    gameId: server.id,
    course: server.course,
    totalHoles: server.totalHoles,
    teeCourseRating: server.teeCourseRating,
    teeSlope: server.teeSlope,
    teeParTotal: server.teeParTotal,
    teeHoleCount: server.teeHoleCount,
    handicapAllowance: server.handicapAllowance,
    holes: server.holes.map((h) => ({ id: h.id, number: h.number, par: h.par, distance: h.distance, index: h.index })),
    players: server.players.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      image: p.image,
      playingHandicap: p.playingHandicap,
      userHandicap: p.userHandicap,
    })),
    scores,
    localStatus,
    finishSyncStatus,
    finishErrorReason: previous?.finishErrorReason,
    snapshotSavedAt: now,
    lastSyncAttemptAt: previous?.lastSyncAttemptAt ?? null,
  };
}

/** ¿Queda algo por sincronizar? (algún Score pending, o la finalización pendiente). Lo usa la UX discreta y el trigger de sync. */
export function hasPendingChanges(game: LocalGame): boolean {
  if (game.finishSyncStatus === "pending") return true;
  return Object.values(game.scores).some((s) => s.syncStatus === "pending");
}

/** ¿Hay algún error permanente sin resolver? (Score o finalización). */
export function hasSyncErrors(game: LocalGame): boolean {
  if (game.finishSyncStatus === "error") return true;
  return Object.values(game.scores).some((s) => s.syncStatus === "error");
}
