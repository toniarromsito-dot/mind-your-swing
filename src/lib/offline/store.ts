"use client";

import { Preferences } from "@capacitor/preferences";
import type { LocalGame } from "./types";

/**
 * Persistencia local de Jugar — Capacitor Preferences (UserDefaults en iOS,
 * SharedPreferences en Android, localStorage en la implementación web del
 * propio plugin): sobrevive cierre de app, crash, suspensión y el
 * reload-al-reanudar de NativeAppInit, que es justo lo que el estado React
 * por sí solo no aguanta. Volumen real por partida (18 hoyos × varios
 * jugadores, sin Shot) es de pocos KB en JSON — muy por debajo de
 * cualquier límite razonable de Preferences; no hace falta SQLite para
 * esta fase (decisión aprobada, ver informe).
 *
 * Solo se guarda 1 partida "activa" a la vez (0-1 partidas IN_PROGRESS por
 * jugador es el caso real, según el audit) — no es un histórico ni una
 * cola de múltiples partidas.
 */

const GAME_PREFIX = "mys:offline:game:";
const ACTIVE_GAME_ID_KEY = "mys:offline:activeGameId";

function gameKey(gameId: string): string {
  return `${GAME_PREFIX}${gameId}`;
}

/**
 * Cola de exclusión por partida — un tap de golpe (recordScore) y un
 * intento de sincronización en curso (sync.ts) pueden solaparse en el
 * tiempo (el segundo dispara antes de que el primero, que espera a la
 * red, haya terminado su propio ciclo lectura→escritura). Sin esto, el
 * que termina último puede sobrescribir con una copia desactualizada el
 * cambio del otro — se detectó de verdad probando "finalizar justo
 * después de anotar el último golpe" (ver informe). Cada mutación pasa
 * por aquí: nunca se escribe a partir de una copia leída antes de que
 * termine cualquier escritura ya en curso para esa misma partida.
 */
const gameLocks = new Map<string, Promise<void>>();

async function withGameLock<T>(gameId: string, fn: () => Promise<T>): Promise<T> {
  const previous = gameLocks.get(gameId) ?? Promise.resolve();
  let release!: () => void;
  const ownTurn = new Promise<void>((resolve) => {
    release = resolve;
  });
  gameLocks.set(
    gameId,
    previous.then(() => ownTurn)
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function saveLocalGame(game: LocalGame): Promise<void> {
  await withGameLock(game.gameId, async () => {
    await Preferences.set({ key: gameKey(game.gameId), value: JSON.stringify(game) });
    await Preferences.set({ key: ACTIVE_GAME_ID_KEY, value: game.gameId });
  });
}

/**
 * Lectura-modificación-escritura atómica respecto a otras llamadas a
 * `updateLocalGame`/`saveLocalGame` de la MISMA partida — el patch recibe
 * siempre el estado más reciente, nunca una copia leída antes de que otra
 * mutación en vuelo termine la suya. Es la única forma en que sync.ts debe
 * escribir resultados parciales (por hoyo, o de finalización).
 */
export async function updateLocalGame(gameId: string, patch: (game: LocalGame) => LocalGame): Promise<LocalGame | null> {
  return withGameLock(gameId, async () => {
    const { value } = await Preferences.get({ key: gameKey(gameId) });
    if (!value) return null;
    let current: LocalGame;
    try {
      current = JSON.parse(value) as LocalGame;
    } catch {
      return null;
    }
    const next = patch(current);
    await Preferences.set({ key: gameKey(gameId), value: JSON.stringify(next) });
    await Preferences.set({ key: ACTIVE_GAME_ID_KEY, value: gameId });
    return next;
  });
}

export async function loadLocalGame(gameId: string): Promise<LocalGame | null> {
  const { value } = await Preferences.get({ key: gameKey(gameId) });
  if (!value) return null;
  try {
    return JSON.parse(value) as LocalGame;
  } catch {
    // JSON corrupto (no debería pasar nunca) — se trata como si no hubiera nada local, nunca se lanza y se pierde el hilo del jugador.
    return null;
  }
}

/** Id de la partida activa localmente, si hay una — lo usa NativeAppInit sin tener que cargar el snapshot entero al reanudar. */
export async function getActiveLocalGameId(): Promise<string | null> {
  const { value } = await Preferences.get({ key: ACTIVE_GAME_ID_KEY });
  return value || null;
}

/** Se llama cuando la partida ya está sincronizada del todo (score + finalización) y deja de necesitar protección offline. */
export async function clearLocalGame(gameId: string): Promise<void> {
  await Preferences.remove({ key: gameKey(gameId) });
  const activeId = await getActiveLocalGameId();
  if (activeId === gameId) {
    await Preferences.remove({ key: ACTIVE_GAME_ID_KEY });
  }
}
