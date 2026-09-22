// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerGameSnapshot } from "./reconcile";

/**
 * Tests a nivel de hook (jsdom) para las tres correcciones que solo se
 * pueden observar con el ciclo de vida real de React — Fase de corrección
 * de race conditions, puntos 4 (lock de sync), 5 (doble finalización) y 6
 * (robustez ante fallo de storage). Las demás correcciones (puntos 1-3) ya
 * están cubiertas a nivel de función pura en sync.test.ts.
 *
 * Sin `@testing-library/react` (su peer `@testing-library/dom` no está
 * instalado en el proyecto y no queremos añadir una dependencia nueva solo
 * para esto) — un `renderHook` mínimo propio, con `react-dom/client` +
 * `act` de `react` (ambos ya son dependencias del proyecto), es suficiente
 * para lo que hace falta probar aquí.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/actions/games", () => ({
  saveHoleScores: vi.fn(),
  finishGame: vi.fn(),
}));

let networkConnected = true;
vi.mock("@capacitor/network", () => ({
  Network: {
    getStatus: vi.fn(async () => ({ connected: networkConnected })),
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
  },
}));

const memory = new Map<string, string>();
let failStorage = false;
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => {
      if (failStorage) throw new Error("Storage no disponible");
      return { value: memory.get(key) ?? null };
    }),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      if (failStorage) throw new Error("Storage no disponible");
      memory.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      memory.delete(key);
    }),
  },
}));

const { saveHoleScores, finishGame } = await import("@/actions/games");
const { useOfflineGame } = await import("./use-offline-game");
const { loadLocalGame, updateLocalGame } = await import("./store");
const { scoreKey } = await import("./types");

function server(overrides: Partial<ServerGameSnapshot> = {}): ServerGameSnapshot {
  return {
    id: "game-1",
    course: "Campo de pruebas",
    totalHoles: 1,
    teeCourseRating: null,
    teeSlope: null,
    teeParTotal: null,
    teeHoleCount: null,
    handicapAllowance: null,
    status: "IN_PROGRESS",
    holes: [{ id: "hole-1", number: 1, par: 4, distance: null, index: 1 }],
    players: [{ id: "p1", userId: "u1", name: "Jugador", image: null, playingHandicap: null, userHandicap: null, scores: [] }],
    ...overrides,
  };
}

/** `renderHook` mínimo: monta un componente que solo ejecuta el hook y expone su último resultado. */
function renderHook<T>(hook: () => T) {
  let latest!: T;
  function TestComponent() {
    latest = hook();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(createElement(TestComponent));
  });
  return {
    get current() {
      return latest;
    },
    unmount: () => act(() => root.unmount()),
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: se agotó el tiempo de espera");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

describe("useOfflineGame — lock de sync, doble finalización y robustez de storage (Fase de corrección, puntos 4-6)", () => {
  beforeEach(() => {
    memory.clear();
    failStorage = false;
    networkConnected = true;
    vi.mocked(saveHoleScores).mockReset().mockResolvedValue(undefined);
    vi.mocked(finishGame).mockReset().mockResolvedValue(undefined);
  });

  it("punto 4 — dos runSync() casi simultáneos nunca ejecutan syncGame en paralelo", async () => {
    const hook = renderHook(() => useOfflineGame(server()));
    await waitFor(() => hook.current.localGame !== null);

    // Dos toques casi a la vez (mismo tick) sobre el mismo hoyo: cada
    // recordScore dispara su propio runSync() fire-and-forget.
    act(() => {
      hook.current.recordScore("hole-1", "p1", 4, null);
      hook.current.recordScore("hole-1", "p1", 4, null);
    });

    await waitFor(() => vi.mocked(saveHoleScores).mock.calls.length > 0);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30)); // deja asentar cualquier sync en vuelo
    });

    // Si el lock se adquiriese después de un await (el bug original), esta
    // ventana podría dejar pasar dos syncGame() en paralelo. Con el fix,
    // como mucho una de las dos llamadas llega a ejecutar syncPendingScores.
    expect(vi.mocked(saveHoleScores)).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  it("punto 5 — requestFinish() sobre una partida ya sincronizada y limpiada no muestra un error falso", async () => {
    const hook = renderHook(() => useOfflineGame(server()));
    await waitFor(() => hook.current.localGame !== null);

    act(() => {
      hook.current.recordScore("hole-1", "p1", 4, null);
    });
    await act(async () => {
      await hook.current.requestFinish();
    });

    await waitFor(() => hook.current.finishConfirmed === true);
    expect(hook.current.preloadError).toBe(false);
    expect(await loadLocalGame("game-1")).toBeNull(); // confirmado: ya se limpió

    // Segunda llamada (doble tap / botón atrás reabriendo el diálogo de
    // confirmar) sobre una partida que ya no tiene nada en storage.
    await act(async () => {
      await hook.current.requestFinish();
    });

    expect(hook.current.preloadError).toBe(false); // nunca un aviso de "no se pudo preparar el respaldo local"
    expect(hook.current.finishConfirmed).toBe(true); // sigue reflejando que la vuelta terminó bien

    hook.unmount();
  });

  it("punto 6 — un fallo de storage durante el sync no deja el lock atascado", async () => {
    const hook = renderHook(() => useOfflineGame(server()));
    await waitFor(() => hook.current.localGame !== null);

    // Deja un Score realmente pendiente en storage (con storage sano),
    // sin pasar por recordScore() para no disparar su propio runSync()
    // automático antes de poder forzar el fallo.
    await updateLocalGame("game-1", (current) => ({
      ...current,
      scores: {
        ...current.scores,
        [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: Date.now() },
      },
    }));

    failStorage = true;
    await act(async () => {
      await hook.current.runSync(); // el intento con storage roto debe terminar solo (con error interno), sin colgar el hook
    });
    expect(saveHoleScores).not.toHaveBeenCalled(); // ni siquiera llegó a leer los pendientes

    failStorage = false;
    await act(async () => {
      await hook.current.runSync();
    });

    // El lock se liberó correctamente: esta segunda llamada, ya con
    // storage sano, sí puede sincronizar el Score que se quedó pendiente.
    await waitFor(() => vi.mocked(saveHoleScores).mock.calls.length > 0);

    hook.unmount();
  });
});
