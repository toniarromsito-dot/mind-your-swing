"use client";

import { saveHoleScores, finishGame } from "@/actions/games";
import { loadLocalGame, updateLocalGame, clearLocalGame } from "./store";
import { scoreKey, type LocalGame } from "./types";

/**
 * Motor de sincronización — Bloque 5. Unidad lógica: gameId + holeId +
 * playerId (mismo grano que `@@unique([holeId, playerId])` en Score, ver
 * audit) — nunca se inventa un id de operación aparte para los Score,
 * reutilizando la idempotencia que ya existe en el servidor.
 *
 * Clasificación de errores (decisión de diseño, sin cambios de servidor):
 * un fallo de red real (sin conexión, timeout, DNS) llega como `TypeError`
 * al llamar a una Server Action — se trata como reintentable ("pending"
 * sigue). Cualquier otro error (la propia Server Action lanzando
 * "No autenticado"/"No perteneces a esta partida"/validación de Zod) es un
 * rechazo explícito del servidor — se marca "error" y NO se reintenta
 * automáticamente, para no repetir indefinidamente algo que nunca va a
 * funcionar (sesión inválida, ownership, dato inválido).
 *
 * Cada resultado se escribe con `updateLocalGame` (lectura-modificación-
 * escritura serializada por partida, ver store.ts) — nunca acumulando un
 * snapshot en memoria a lo largo de todo el bucle.
 */

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

export type SyncResult = {
  syncedScores: number;
  failedScores: number;
  finishSynced: boolean;
  finishFailed: boolean;
  /** true si, al terminar este pase, NINGÚN Score de la partida sigue "pending"/"error". */
  scoresSynced: boolean;
  /** true si, al terminar este pase, `finishSyncStatus === "synced"` — señal explícita y determinista para que la UI navegue, sin depender de releer un LocalGame que este mismo pase puede haber limpiado. */
  finishCompleted: boolean;
};

/**
 * Aplica el resultado de una petición de red sobre el Score (holeId,
 * playerId) SOLO si el valor local sigue siendo exactamente el que se
 * envió en esa petición (mismo strokes/putts/updatedAt de origen). Si el
 * jugador ya lo cambió mientras la petición seguía en vuelo, la respuesta
 * (éxito o error) ya no aplica a nada: ni se marca "synced" (perdería para
 * siempre el valor nuevo, que nunca se habría enviado) ni se marca "error"
 * (el valor nuevo no ha sido intentado todavía, no tiene por qué fallar
 * igual). Se deja intacto, tal cual está, para que el siguiente pase de
 * sync lo recoja con su valor real. Ver Fase de corrección de race
 * conditions, punto 1.
 */
function applyScoreSyncOutcome(
  game: LocalGame,
  holeId: string,
  playerId: string,
  sent: { strokes: number | null; putts: number | null; sentUpdatedAt: number },
  now: number,
  outcome: { status: "synced" } | { status: "error"; reason: string }
): LocalGame {
  const key = scoreKey(holeId, playerId);
  const existing = game.scores[key];
  if (!existing) return game;

  const stillSameValue =
    existing.strokes === sent.strokes && existing.putts === sent.putts && existing.updatedAt === sent.sentUpdatedAt;
  if (!stillSameValue) return game; // stale: la respuesta es para un valor que ya no es el actual

  const patch =
    outcome.status === "synced"
      ? { syncStatus: "synced" as const, updatedAt: now }
      : { syncStatus: "error" as const, updatedAt: now, errorReason: outcome.reason };
  return { ...game, scores: { ...game.scores, [key]: { ...existing, ...patch } } };
}

/** Sincroniza todos los Score "pending" de una partida, agrupados por hoyo (una llamada a saveHoleScores por hoyo, igual que ya hace el scorecard online). */
export async function syncPendingScores(gameId: string): Promise<{ syncedScores: number; failedScores: number }> {
  const game = await loadLocalGame(gameId);
  if (!game) return { syncedScores: 0, failedScores: 0 };

  const pendingByHole = new Map<
    string,
    { playerId: string; strokes: number | null; putts: number | null; sentUpdatedAt: number }[]
  >();
  for (const [key, entry] of Object.entries(game.scores)) {
    if (entry.syncStatus !== "pending") continue;
    const [holeId, playerId] = key.split(":");
    const list = pendingByHole.get(holeId) ?? [];
    list.push({ playerId, strokes: entry.strokes, putts: entry.putts, sentUpdatedAt: entry.updatedAt });
    pendingByHole.set(holeId, list);
  }

  let syncedScores = 0;
  let failedScores = 0;

  for (const [holeId, entries] of pendingByHole) {
    try {
      await saveHoleScores({
        gameId,
        holeId,
        entries: entries.map((e) => ({ playerId: e.playerId, strokes: e.strokes, putts: e.putts, club: null })),
      });
      const now = Date.now();
      let confirmed = 0;
      await updateLocalGame(gameId, (current) => {
        let next = current;
        for (const e of entries) {
          const before = next;
          next = applyScoreSyncOutcome(next, holeId, e.playerId, e, now, { status: "synced" });
          if (next !== before) confirmed++;
        }
        return { ...next, lastSyncAttemptAt: now };
      });
      syncedScores += confirmed;
      // Las entradas "stale" (el jugador las cambió mientras esta petición
      // seguía en vuelo) se quedan tal cual, pending, con su valor real —
      // el siguiente pase de sync las reenvía. Nunca se cuentan aquí como
      // sincronizadas ni como fallidas.
    } catch (err) {
      if (isNetworkError(err)) {
        // Sigue "pending" — se reintentará en la próxima ventana de sync.
        await updateLocalGame(gameId, (current) => ({ ...current, lastSyncAttemptAt: Date.now() }));
        continue;
      }
      const reason = err instanceof Error ? err.message : "Error desconocido";
      const now = Date.now();
      let errored = 0;
      await updateLocalGame(gameId, (current) => {
        let next = current;
        for (const e of entries) {
          const before = next;
          next = applyScoreSyncOutcome(next, holeId, e.playerId, e, now, { status: "error", reason });
          if (next !== before) errored++;
        }
        return { ...next, lastSyncAttemptAt: now };
      });
      failedScores += errored;
    }
  }

  return { syncedScores, failedScores };
}

/**
 * Sincroniza la finalización si está pendiente. `finishGame` en el
 * servidor ya es idempotente por diseño (solo actúa si `Game.status ===
 * "IN_PROGRESS"`, ver actions/games.ts) — llamarlo dos veces no duplica
 * nada.
 *
 * BLOQUEO OBLIGATORIO (Fase de corrección, punto 2): si queda algún Score
 * de esta partida en "pending" o "error", NUNCA se llama a finishGame —
 * el servidor no debe marcar COMPLETED una vuelta de la que le falta un
 * hoyo. Esto incluye los errores permanentes (401/403/validación): un
 * Score en "error" nunca se reintenta solo (ver syncPendingScores), así
 * que bloquea el finish indefinidamente hasta que se resuelva (p. ej. el
 * jugador vuelve a introducir ese hoyo, lo que lo pone "pending" de
 * nuevo). Es una decisión de producto explícita, no un descuido: mejor
 * una vuelta que tarda en cerrarse que una vuelta COMPLETED con datos
 * que el servidor nunca confirmó.
 */
export async function syncFinish(gameId: string): Promise<{ finishSynced: boolean; finishFailed: boolean }> {
  const game = await loadLocalGame(gameId);
  if (!game || game.finishSyncStatus !== "pending") return { finishSynced: false, finishFailed: false };

  const blockedByScores = Object.values(game.scores).some((s) => s.syncStatus !== "synced");
  if (blockedByScores) return { finishSynced: false, finishFailed: false };

  try {
    await finishGame(gameId);
  } catch (err) {
    if (isNetworkError(err)) {
      await updateLocalGame(gameId, (current) => ({ ...current, lastSyncAttemptAt: Date.now() })).catch(() => {});
      return { finishSynced: false, finishFailed: false };
    }
    const reason = err instanceof Error ? err.message : "Error desconocido";
    await updateLocalGame(gameId, (current) => ({
      ...current,
      finishSyncStatus: "error",
      finishErrorReason: reason,
      lastSyncAttemptAt: Date.now(),
    })).catch(() => {});
    return { finishSynced: false, finishFailed: true };
  }

  // finishGame ya tuvo éxito EN EL SERVIDOR en este punto — un fallo al
  // escribir el flag local "synced" (storage roto, ver Fase de corrección
  // punto 6) nunca debe deshacer ni relanzar sin control ese hecho ya
  // consumado: el servidor sigue COMPLETED pase lo que pase aquí, y la
  // reconciliación del próximo montaje (buildLocalGameFromServer) lo
  // corrige leyendo Game.status real si este flag se quedase desfasado.
  await updateLocalGame(gameId, (current) => ({
    ...current,
    localStatus: "completed_synced",
    finishSyncStatus: "synced",
    finishErrorReason: undefined,
    lastSyncAttemptAt: Date.now(),
  })).catch(() => {});

  return { finishSynced: true, finishFailed: false };
}

/**
 * Drena scores pendientes y, si procede, la finalización — lo que llama la
 * UI al detectar conexión o al reanudar. Devuelve un resultado EXPLÍCITO
 * (`scoresSynced`/`finishCompleted`) para que quien llama pueda decidir si
 * navegar sin tener que releer el storage después de esta misma función
 * (que puede haberlo limpiado) — ver Fase de corrección, punto 3.
 */
export async function syncGame(gameId: string): Promise<SyncResult> {
  const { syncedScores, failedScores } = await syncPendingScores(gameId);
  const { finishSynced, finishFailed } = await syncFinish(gameId);

  // Se relee ANTES de decidir si limpiar, todavía dentro de esta misma
  // llamada — así el resultado que se devuelve refleja el estado real de
  // ESTE pase, exista o no el storage un instante después.
  const finalState = await loadLocalGame(gameId);
  const scoresSynced = finalState ? !Object.values(finalState.scores).some((s) => s.syncStatus !== "synced") : true;
  const finishCompleted = finalState ? finalState.finishSyncStatus === "synced" : true;

  if (finalState && finishCompleted && scoresSynced) {
    await clearLocalGame(gameId);
  }
  // Si `finalState` ya es null aquí, es porque otra llamada a syncGame()
  // concurrente para la misma partida ya confirmó y limpió todo — seguimos
  // siendo capaces de informar `finishCompleted: true` sin depender de un
  // storage que ya no existe.

  return { syncedScores, failedScores, finishSynced, finishFailed, scoresSynced, finishCompleted };
}
