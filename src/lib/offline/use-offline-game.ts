"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getConnectivity, useConnectivity } from "./connectivity";
import { loadLocalGame, saveLocalGame, updateLocalGame } from "./store";
import { buildLocalGameFromServer, hasPendingChanges, hasSyncErrors, type ServerGameSnapshot } from "./reconcile";
import { syncGame } from "./sync";
import { scoreKey, type LocalGame, type SyncUxStatus } from "./types";

/** Reintento periódico suave mientras queden pendientes — nunca un loop agresivo (decisión aprobada, Bloque 8). */
const RETRY_INTERVAL_MS = 20_000;

/**
 * Hook único que GameView monta para tener Jugar en local-first — Bloque
 * 4/9 (reconciliación) + expone `recordScore`/`requestFinish` para que
 * SharedScorecard y el botón de finalizar (Bloque 3/6) nunca llamen a
 * saveHoleScores/finishGame directamente.
 */
export function useOfflineGame(server: ServerGameSnapshot) {
  const [localGame, setLocalGame] = useState<LocalGame | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [preloadError, setPreloadError] = useState(false);
  // Señal explícita y determinista de "el servidor ya confirmó COMPLETED
  // en este pase de sync" — GameView navega a partir de esto, nunca
  // releyendo `localGame` después de que syncGame() pueda haberlo limpiado
  // (ver Fase de corrección de race conditions, punto 3).
  const [finishConfirmed, setFinishConfirmed] = useState(false);
  const connectivity = useConnectivity();
  const syncingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const previous = await loadLocalGame(server.id);
      const merged = buildLocalGameFromServer(server, previous, Date.now());
      try {
        await saveLocalGame(merged);
      } catch {
        // Bloque 3: si el respaldo local no se pudo preparar, no fingir
        // que la vuelta está protegida offline — se avisa una vez (ver
        // GameView) y se sigue jugando online-only con el snapshot en
        // memoria, en vez de bloquear la partida.
        if (!cancelled) setPreloadError(true);
      }
      if (!cancelled) setLocalGame(merged);
    })();
    return () => {
      cancelled = true;
    };
    // Solo al montar/cambiar de partida: `server` es la foto inicial del
    // Server Component, no algo que deba re-disparar la reconciliación en
    // cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server.id]);

  const runSync = useCallback(async () => {
    // El lock se adquiere ANTES del primer `await` — síncronamente, en el
    // mismo tick en el que se llama runSync(). Si esto se comprobara
    // después de un `await` (p. ej. el de getConnectivity), dos llamadas a
    // runSync() casi simultáneas podrían pasar ambas el check antes de que
    // ninguna activara el flag, y ejecutar syncGame() en paralelo para la
    // misma partida (ver Fase de corrección de race conditions, punto 4).
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      // Comprobación real, no solo el estado de React ya calculado — nunca
      // asumir que "online" en pantalla garantiza que esto vaya a funcionar.
      if ((await getConnectivity()) === "offline") return;

      setIsSyncing(true);
      const result = await syncGame(server.id);
      if (result.finishCompleted) setFinishConfirmed(true);
    } catch {
      // Un fallo aquí (p. ej. storage inoperativo a mitad de sync, ver
      // punto 6) nunca debe impedir que el `finally` libere el lock. El
      // servidor puede haber quedado COMPLETED igualmente — la próxima
      // reconciliación (montaje/recarga) lo confirma leyendo Game.status
      // real, así que no hace falta relanzar el error aquí.
    } finally {
      setIsSyncing(false);
      try {
        const fresh = await loadLocalGame(server.id);
        setLocalGame(fresh);
      } catch {
        // Igual: no dejamos que un fallo de lectura final impida liberar el lock.
      }
      syncingRef.current = false;
    }
  }, [server.id]);

  useEffect(() => {
    // Sincroniza con el sistema externo de conectividad — no re-deriva
    // estado de React (mismo patrón ya usado en native-onboarding.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- runSync() reacciona a un cambio de conectividad real, no deriva estado de props/render
    if (connectivity === "online") runSync();
  }, [connectivity, runSync]);

  useEffect(() => {
    if (!localGame || !hasPendingChanges(localGame)) return;
    const id = setInterval(runSync, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [localGame, runSync]);

  const recordScore = useCallback(
    (holeId: string, playerId: string, strokes: number | null, putts: number | null) => {
      const key = scoreKey(holeId, playerId);
      const entry = { strokes, putts, syncStatus: "pending" as const, updatedAt: Date.now() };

      // Estado de React: respuesta visual inmediata, nunca espera a la red.
      setLocalGame((prev) => (prev ? { ...prev, scores: { ...prev.scores, [key]: entry } } : prev));

      // Persistencia: SIEMPRE via `updateLocalGame`, que relee el estado más
      // reciente bajo el lock de la partida antes de aplicar el patch — así
      // nunca pisa una escritura concurrente (p. ej. requestFinish) con una
      // copia tomada del estado de React, que puede haber quedado atrás.
      updateLocalGame(server.id, (current) => ({ ...current, scores: { ...current.scores, [key]: entry } })).catch(() =>
        setPreloadError(true)
      );
      void runSync();
    },
    [runSync, server.id]
  );

  const requestFinish = useCallback(async () => {
    setLocalGame((prev) =>
      prev ? { ...prev, localStatus: "completed_pending_sync", finishSyncStatus: "pending" } : prev
    );
    const updated = await updateLocalGame(server.id, (current) => ({
      ...current,
      localStatus: "completed_pending_sync",
      finishSyncStatus: "pending",
    }));
    if (!updated) {
      // No hay nada que actualizar en storage — esto SOLO puede pasar
      // porque syncGame() ya limpió esta partida al confirmar que todo
      // (scores + finish) quedó sincronizado. No es un fallo del respaldo
      // local: ya no hace falta ninguno. Llamar aquí a requestFinish() por
      // segunda vez (doble tap, o el botón atrás reabriendo el diálogo de
      // confirmar) debe ser un no-op silencioso, nunca un aviso de error
      // falso (ver Fase de corrección de race conditions, punto 5).
      setFinishConfirmed(true);
      return;
    }
    await runSync();
  }, [runSync, server.id]);

  const status: SyncUxStatus = !localGame
    ? "online"
    : connectivity === "offline"
      ? "offline"
      : isSyncing
        ? "syncing"
        : hasSyncErrors(localGame) || hasPendingChanges(localGame)
          ? "sync_error"
          : "synced";

  return { localGame, status, preloadError, finishConfirmed, recordScore, requestFinish, runSync };
}
