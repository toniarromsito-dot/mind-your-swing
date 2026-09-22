import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreKey, type LocalGame } from "./types";

vi.mock("@/actions/games", () => ({
  saveHoleScores: vi.fn(),
  finishGame: vi.fn(),
}));

const memory = new Map<string, string>();
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: memory.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      memory.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      memory.delete(key);
    }),
  },
}));

const { saveHoleScores, finishGame } = await import("@/actions/games");
const { saveLocalGame, loadLocalGame, updateLocalGame } = await import("./store");
const { syncPendingScores, syncFinish, syncGame } = await import("./sync");

function baseLocalGame(overrides: Partial<LocalGame> = {}): LocalGame {
  return {
    gameId: "game-1",
    course: "Campo de pruebas",
    totalHoles: 1,
    teeCourseRating: null,
    teeSlope: null,
    teeParTotal: null,
    teeHoleCount: null,
    handicapAllowance: null,
    holes: [{ id: "hole-1", number: 1, par: 4, distance: null, index: 1 }],
    players: [{ id: "p1", userId: "u1", name: "Jugador", image: null, playingHandicap: null, userHandicap: null }],
    scores: {},
    localStatus: "active",
    finishSyncStatus: "idle",
    snapshotSavedAt: 0,
    lastSyncAttemptAt: null,
    ...overrides,
  };
}

describe("syncPendingScores — clasificación de errores (mocks, sin DB real)", () => {
  beforeEach(() => {
    memory.clear();
    vi.mocked(saveHoleScores).mockReset();
    vi.mocked(finishGame).mockReset();
  });

  it("éxito: marca el Score como synced", async () => {
    await saveLocalGame(
      baseLocalGame({ scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1 } } })
    );
    vi.mocked(saveHoleScores).mockResolvedValueOnce(undefined);

    const result = await syncPendingScores("game-1");
    expect(result).toEqual({ syncedScores: 1, failedScores: 0 });

    const after = await loadLocalGame("game-1");
    expect(after!.scores[scoreKey("hole-1", "p1")].syncStatus).toBe("synced");
  });

  it("error de red (TypeError, sin conexión real): el Score sigue 'pending', nunca se pierde", async () => {
    await saveLocalGame(
      baseLocalGame({ scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1 } } })
    );
    vi.mocked(saveHoleScores).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await syncPendingScores("game-1");
    expect(result).toEqual({ syncedScores: 0, failedScores: 0 });

    const after = await loadLocalGame("game-1");
    expect(after!.scores[scoreKey("hole-1", "p1")].syncStatus).toBe("pending");
    expect(after!.scores[scoreKey("hole-1", "p1")].strokes).toBe(4); // el dato original sigue intacto
  });

  it("error permanente del servidor (ownership/auth/validación): se marca 'error' con motivo, no se reintenta como pending", async () => {
    await saveLocalGame(
      baseLocalGame({ scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1 } } })
    );
    vi.mocked(saveHoleScores).mockRejectedValueOnce(new Error("No perteneces a esta partida"));

    const result = await syncPendingScores("game-1");
    expect(result).toEqual({ syncedScores: 0, failedScores: 1 });

    const after = await loadLocalGame("game-1");
    const entry = after!.scores[scoreKey("hole-1", "p1")];
    expect(entry.syncStatus).toBe("error");
    expect(entry.errorReason).toBe("No perteneces a esta partida");
  });

  it("agrupa varios Score pendientes del mismo hoyo en una sola llamada a saveHoleScores", async () => {
    await saveLocalGame(
      baseLocalGame({
        players: [
          { id: "p1", userId: "u1", name: "A", image: null, playingHandicap: null, userHandicap: null },
          { id: "p2", userId: "u2", name: "B", image: null, playingHandicap: null, userHandicap: null },
        ],
        scores: {
          [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1 },
          [scoreKey("hole-1", "p2")]: { strokes: 5, putts: null, syncStatus: "pending", updatedAt: 1 },
        },
      })
    );
    vi.mocked(saveHoleScores).mockResolvedValueOnce(undefined);

    const result = await syncPendingScores("game-1");
    expect(result).toEqual({ syncedScores: 2, failedScores: 0 });
    expect(saveHoleScores).toHaveBeenCalledTimes(1);
    expect(saveHoleScores).toHaveBeenCalledWith({
      gameId: "game-1",
      holeId: "hole-1",
      entries: [
        { playerId: "p1", strokes: 4, putts: null, club: null },
        { playerId: "p2", strokes: 5, putts: null, club: null },
      ],
    });
  });

  it("sin snapshot local, no hace nada (no lanza)", async () => {
    const result = await syncPendingScores("no-existe");
    expect(result).toEqual({ syncedScores: 0, failedScores: 0 });
  });
});

describe("syncPendingScores — confirmación ligada al VALOR enviado, no solo a la clave (Fase de corrección, punto 1)", () => {
  beforeEach(() => {
    memory.clear();
    vi.mocked(saveHoleScores).mockReset();
    vi.mocked(finishGame).mockReset();
  });

  it("si el usuario cambia el Score mientras la petición está en vuelo, la respuesta NO lo marca 'synced' (queda stale)", async () => {
    const key = scoreKey("hole-1", "p1");
    await saveLocalGame(baseLocalGame({ scores: { [key]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1000 } } }));

    vi.mocked(saveHoleScores).mockImplementationOnce(async () => {
      // Simula exactamente la ventana de carrera del audit: mientras esta
      // petición (que envía strokes:4) sigue en vuelo, el jugador vuelve al
      // hoyo y lo cambia a 5 — se persiste ANTES de que saveHoleScores
      // resuelva.
      await updateLocalGame("game-1", (current) => ({
        ...current,
        scores: { ...current.scores, [key]: { strokes: 5, putts: null, syncStatus: "pending", updatedAt: 2000 } },
      }));
    });

    const result = await syncPendingScores("game-1");
    expect(result).toEqual({ syncedScores: 0, failedScores: 0 }); // el 4 nunca se confirma: ya no es el valor actual

    const after = await loadLocalGame("game-1");
    expect(after!.scores[key]).toEqual({ strokes: 5, putts: null, syncStatus: "pending", updatedAt: 2000 }); // el 5 sigue intacto y pending
  });

  it("el valor nuevo (5) se sincroniza correctamente en el siguiente intento", async () => {
    const key = scoreKey("hole-1", "p1");
    await saveLocalGame(baseLocalGame({ scores: { [key]: { strokes: 5, putts: null, syncStatus: "pending", updatedAt: 2000 } } }));
    vi.mocked(saveHoleScores).mockResolvedValueOnce(undefined);

    const result = await syncPendingScores("game-1");
    expect(result).toEqual({ syncedScores: 1, failedScores: 0 });
    expect(saveHoleScores).toHaveBeenCalledWith({
      gameId: "game-1",
      holeId: "hole-1",
      entries: [{ playerId: "p1", strokes: 5, putts: null, club: null }],
    });

    const after = await loadLocalGame("game-1");
    expect(after!.scores[key].syncStatus).toBe("synced");
    expect(after!.scores[key].strokes).toBe(5);
  });

  it("un error permanente para un valor ya obsoleto tampoco lo marca 'error' — no bloquea el valor nuevo, que no se ha intentado todavía", async () => {
    const key = scoreKey("hole-1", "p1");
    await saveLocalGame(baseLocalGame({ scores: { [key]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1000 } } }));

    vi.mocked(saveHoleScores).mockImplementationOnce(async () => {
      await updateLocalGame("game-1", (current) => ({
        ...current,
        scores: { ...current.scores, [key]: { strokes: 5, putts: null, syncStatus: "pending", updatedAt: 2000 } },
      }));
      throw new Error("Datos inválidos");
    });

    const result = await syncPendingScores("game-1");
    expect(result).toEqual({ syncedScores: 0, failedScores: 0 }); // ni synced ni error: stale

    const after = await loadLocalGame("game-1");
    expect(after!.scores[key]).toEqual({ strokes: 5, putts: null, syncStatus: "pending", updatedAt: 2000 });
  });
});

describe("syncFinish — idempotencia local", () => {
  beforeEach(() => {
    memory.clear();
    vi.mocked(saveHoleScores).mockReset();
    vi.mocked(finishGame).mockReset();
  });

  it("si finishSyncStatus no está 'pending', no llama a finishGame (no reintenta lo ya resuelto)", async () => {
    await saveLocalGame(baseLocalGame({ finishSyncStatus: "synced", localStatus: "completed_synced" }));
    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: false, finishFailed: false });
    expect(finishGame).not.toHaveBeenCalled();
  });

  it("éxito: marca completed_synced", async () => {
    await saveLocalGame(baseLocalGame({ finishSyncStatus: "pending", localStatus: "completed_pending_sync" }));
    vi.mocked(finishGame).mockResolvedValueOnce(undefined);

    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: true, finishFailed: false });

    const after = await loadLocalGame("game-1");
    expect(after!.finishSyncStatus).toBe("synced");
    expect(after!.localStatus).toBe("completed_synced");
  });

  it("error de red: sigue 'pending', se reintentará más tarde", async () => {
    await saveLocalGame(baseLocalGame({ finishSyncStatus: "pending", localStatus: "completed_pending_sync" }));
    vi.mocked(finishGame).mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: false, finishFailed: false });

    const after = await loadLocalGame("game-1");
    expect(after!.finishSyncStatus).toBe("pending");
  });

  it("retry: tras un fallo de red, una llamada posterior vuelve a intentar finishGame", async () => {
    await saveLocalGame(baseLocalGame({ finishSyncStatus: "pending", localStatus: "completed_pending_sync" }));
    vi.mocked(finishGame).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const first = await syncFinish("game-1");
    expect(first).toEqual({ finishSynced: false, finishFailed: false });

    vi.mocked(finishGame).mockResolvedValueOnce(undefined);
    const second = await syncFinish("game-1");
    expect(second).toEqual({ finishSynced: true, finishFailed: false });
    expect(finishGame).toHaveBeenCalledTimes(2);
  });

  it("error permanente (401/403/validación): finishSyncStatus pasa a 'error' con el motivo, la partida no se pierde", async () => {
    await saveLocalGame(
      baseLocalGame({
        finishSyncStatus: "pending",
        localStatus: "completed_pending_sync",
        scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "synced", updatedAt: 1 } },
      })
    );
    vi.mocked(finishGame).mockRejectedValueOnce(new Error("No perteneces a esta partida"));

    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: false, finishFailed: true });

    const after = await loadLocalGame("game-1");
    expect(after!.finishSyncStatus).toBe("error");
    expect(after!.finishErrorReason).toBe("No perteneces a esta partida");
  });
});

describe("syncFinish — BLOQUEO por Scores sin confirmar (Fase de corrección, punto 2)", () => {
  beforeEach(() => {
    memory.clear();
    vi.mocked(saveHoleScores).mockReset();
    vi.mocked(finishGame).mockReset();
  });

  it("un Score 'pending' bloquea finishGame por completo", async () => {
    await saveLocalGame(
      baseLocalGame({
        finishSyncStatus: "pending",
        localStatus: "completed_pending_sync",
        scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1 } },
      })
    );

    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: false, finishFailed: false });
    expect(finishGame).not.toHaveBeenCalled();

    const after = await loadLocalGame("game-1");
    expect(after!.finishSyncStatus).toBe("pending"); // se conserva la intención de finalizar, no se pierde
    expect(after!.localStatus).toBe("completed_pending_sync");
  });

  it("un Score 'error' también bloquea finishGame — nunca se marca COMPLETED con un hoyo que el servidor no confirmó", async () => {
    await saveLocalGame(
      baseLocalGame({
        finishSyncStatus: "pending",
        localStatus: "completed_pending_sync",
        scores: {
          [scoreKey("hole-1", "p1")]: {
            strokes: 4,
            putts: null,
            syncStatus: "error",
            updatedAt: 1,
            errorReason: "No perteneces a esta partida",
          },
        },
      })
    );

    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: false, finishFailed: false });
    expect(finishGame).not.toHaveBeenCalled();
  });

  it("con todos los Scores 'synced', finishGame sí se ejecuta", async () => {
    await saveLocalGame(
      baseLocalGame({
        finishSyncStatus: "pending",
        localStatus: "completed_pending_sync",
        scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "synced", updatedAt: 1 } },
      })
    );
    vi.mocked(finishGame).mockResolvedValueOnce(undefined);

    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: true, finishFailed: false });
    expect(finishGame).toHaveBeenCalledTimes(1);
  });

  it("sin ningún Score registrado, no bloquea (partida vacía)", async () => {
    await saveLocalGame(baseLocalGame({ finishSyncStatus: "pending", localStatus: "completed_pending_sync", scores: {} }));
    vi.mocked(finishGame).mockResolvedValueOnce(undefined);

    const result = await syncFinish("game-1");
    expect(result).toEqual({ finishSynced: true, finishFailed: false });
  });
});

describe("syncGame — resultado explícito para navegación determinista (Fase de corrección, punto 3)", () => {
  beforeEach(() => {
    memory.clear();
    vi.mocked(saveHoleScores).mockReset();
    vi.mocked(finishGame).mockReset();
  });

  it("todo se sincroniza y se finaliza: finishCompleted true, scoresSynced true, storage limpiado", async () => {
    await saveLocalGame(
      baseLocalGame({
        finishSyncStatus: "pending",
        localStatus: "completed_pending_sync",
        scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1 } },
      })
    );
    vi.mocked(saveHoleScores).mockResolvedValueOnce(undefined);
    vi.mocked(finishGame).mockResolvedValueOnce(undefined);

    const result = await syncGame("game-1");
    expect(result.finishCompleted).toBe(true);
    expect(result.scoresSynced).toBe(true);
    expect(await loadLocalGame("game-1")).toBeNull();
  });

  it("un Score falla (permanente): finishCompleted false, scoresSynced false, NO se limpia ni se llama finishGame", async () => {
    await saveLocalGame(
      baseLocalGame({
        finishSyncStatus: "pending",
        localStatus: "completed_pending_sync",
        scores: { [scoreKey("hole-1", "p1")]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 1 } },
      })
    );
    vi.mocked(saveHoleScores).mockRejectedValueOnce(new Error("Datos inválidos"));

    const result = await syncGame("game-1");
    expect(result.finishCompleted).toBe(false);
    expect(result.scoresSynced).toBe(false);
    expect(finishGame).not.toHaveBeenCalled();
    expect(await loadLocalGame("game-1")).not.toBeNull();
  });

  it("llamada redundante sobre una partida ya limpiada: se informa como ya completada, no como fallo", async () => {
    const result = await syncGame("no-existe");
    expect(result).toEqual({
      syncedScores: 0,
      failedScores: 0,
      finishSynced: false,
      finishFailed: false,
      scoresSynced: true,
      finishCompleted: true,
    });
  });
});
