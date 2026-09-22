import { describe, expect, it } from "vitest";
import { buildLocalGameFromServer, hasPendingChanges, hasSyncErrors, reconcileScores, type ServerGameSnapshot } from "./reconcile";
import { scoreKey, type LocalGame, type LocalScoreEntry } from "./types";

function serverPlayer(id: string, scores: { holeId: string; strokes: number | null; putts: number | null }[]) {
  return { id, userId: `user-${id}`, name: `Jugador ${id}`, image: null, playingHandicap: null, userHandicap: null, scores };
}

function baseServer(overrides: Partial<ServerGameSnapshot> = {}): ServerGameSnapshot {
  return {
    id: "game-1",
    course: "Campo de pruebas",
    totalHoles: 2,
    teeCourseRating: null,
    teeSlope: null,
    teeParTotal: null,
    teeHoleCount: null,
    handicapAllowance: null,
    status: "IN_PROGRESS",
    holes: [
      { id: "hole-1", number: 1, par: 4, distance: null, index: 1 },
      { id: "hole-2", number: 2, par: 4, distance: null, index: 2 },
    ],
    players: [serverPlayer("p1", [])],
    ...overrides,
  };
}

describe("reconcileScores", () => {
  it("un Score local 'pending' nunca se pisa por lo que traiga el servidor", () => {
    const server = [serverPlayer("p1", [{ holeId: "hole-1", strokes: 4, putts: null }])];
    const local: Record<string, LocalScoreEntry> = {
      [scoreKey("hole-1", "p1")]: { strokes: 5, putts: null, syncStatus: "pending", updatedAt: 999 },
    };
    const merged = reconcileScores(server, local, 1000);
    expect(merged[scoreKey("hole-1", "p1")]).toEqual(local[scoreKey("hole-1", "p1")]); // gana el local pendiente, no el 4 del servidor
  });

  it("un Score local 'error' tampoco se pisa (sigue necesitando atención, no se descarta)", () => {
    const server = [serverPlayer("p1", [])];
    const local: Record<string, LocalScoreEntry> = {
      [scoreKey("hole-1", "p1")]: { strokes: 6, putts: null, syncStatus: "error", updatedAt: 999, errorReason: "No perteneces a esta partida" },
    };
    const merged = reconcileScores(server, local, 1000);
    expect(merged[scoreKey("hole-1", "p1")]).toEqual(local[scoreKey("hole-1", "p1")]);
  });

  it("un Score local 'synced' se deja ganar por la versión del servidor", () => {
    const server = [serverPlayer("p1", [{ holeId: "hole-1", strokes: 3, putts: 2 }])];
    const local: Record<string, LocalScoreEntry> = {
      [scoreKey("hole-1", "p1")]: { strokes: 3, putts: null, syncStatus: "synced", updatedAt: 500 },
    };
    const merged = reconcileScores(server, local, 1000);
    expect(merged[scoreKey("hole-1", "p1")]).toEqual({ strokes: 3, putts: 2, syncStatus: "synced", updatedAt: 1000 });
  });

  it("un Score que solo existe en el servidor se incorpora como synced", () => {
    const server = [serverPlayer("p1", [{ holeId: "hole-1", strokes: 4, putts: null }])];
    const merged = reconcileScores(server, {}, 1000);
    expect(merged[scoreKey("hole-1", "p1")]).toEqual({ strokes: 4, putts: null, syncStatus: "synced", updatedAt: 1000 });
  });

  it("SERVER=4, LOCAL=5 pending (el caso exacto del audit de race conditions): el reconcile conserva el 5, nunca lo destruye", () => {
    const server = [serverPlayer("p1", [{ holeId: "hole-1", strokes: 4, putts: null }])];
    const local: Record<string, LocalScoreEntry> = {
      [scoreKey("hole-1", "p1")]: { strokes: 5, putts: null, syncStatus: "pending", updatedAt: 2000 },
    };
    const merged = reconcileScores(server, local, 3000);
    expect(merged[scoreKey("hole-1", "p1")]).toEqual({ strokes: 5, putts: null, syncStatus: "pending", updatedAt: 2000 });
  });

  it("un Score que solo existe en local (pending) se conserva tal cual", () => {
    const server = [serverPlayer("p1", [])];
    const local: Record<string, LocalScoreEntry> = {
      [scoreKey("hole-2", "p1")]: { strokes: 5, putts: null, syncStatus: "pending", updatedAt: 42 },
    };
    const merged = reconcileScores(server, local, 1000);
    expect(merged[scoreKey("hole-2", "p1")]).toEqual(local[scoreKey("hole-2", "p1")]);
  });
});

describe("buildLocalGameFromServer", () => {
  it("sin snapshot previo, construye un LocalGame 'active' a partir del servidor", () => {
    const server = baseServer({ players: [serverPlayer("p1", [{ holeId: "hole-1", strokes: 4, putts: null }])] });
    const game = buildLocalGameFromServer(server, null, 1000);
    expect(game.localStatus).toBe("active");
    expect(game.finishSyncStatus).toBe("idle");
    expect(game.scores[scoreKey("hole-1", "p1")]).toEqual({ strokes: 4, putts: null, syncStatus: "synced", updatedAt: 1000 });
  });

  it("si el servidor ya confirma COMPLETED, el LocalGame pasa a completed_synced aunque antes estuviera 'active'", () => {
    const server = baseServer({ status: "COMPLETED" });
    const previous: LocalGame = {
      gameId: "game-1", course: "x", totalHoles: 2, teeCourseRating: null, teeSlope: null, teeParTotal: null,
      teeHoleCount: null, handicapAllowance: null, holes: [], players: [], scores: {},
      localStatus: "active", finishSyncStatus: "idle", snapshotSavedAt: 0, lastSyncAttemptAt: null,
    };
    const game = buildLocalGameFromServer(server, previous, 1000);
    expect(game.localStatus).toBe("completed_synced");
    expect(game.finishSyncStatus).toBe("synced");
  });

  it("si el jugador ya pidió finalizar localmente y el servidor todavía va con retraso (IN_PROGRESS), se respeta la intención local — no reabre la vuelta", () => {
    const server = baseServer({ status: "IN_PROGRESS" });
    const previous: LocalGame = {
      gameId: "game-1", course: "x", totalHoles: 2, teeCourseRating: null, teeSlope: null, teeParTotal: null,
      teeHoleCount: null, handicapAllowance: null, holes: [], players: [], scores: {},
      localStatus: "completed_pending_sync", finishSyncStatus: "pending", snapshotSavedAt: 0, lastSyncAttemptAt: null,
    };
    const game = buildLocalGameFromServer(server, previous, 1000);
    expect(game.localStatus).toBe("completed_pending_sync");
    expect(game.finishSyncStatus).toBe("pending");
  });
});

describe("hasPendingChanges / hasSyncErrors", () => {
  function game(overrides: Partial<LocalGame> = {}): LocalGame {
    return {
      gameId: "g", course: "x", totalHoles: 1, teeCourseRating: null, teeSlope: null, teeParTotal: null,
      teeHoleCount: null, handicapAllowance: null, holes: [], players: [], scores: {},
      localStatus: "active", finishSyncStatus: "idle", snapshotSavedAt: 0, lastSyncAttemptAt: null,
      ...overrides,
    };
  }

  it("hasPendingChanges: true si hay algún Score pending", () => {
    expect(hasPendingChanges(game({ scores: { k: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: 0 } } }))).toBe(true);
  });

  it("hasPendingChanges: true si la finalización está pending, aunque no haya scores pendientes", () => {
    expect(hasPendingChanges(game({ finishSyncStatus: "pending" }))).toBe(true);
  });

  it("hasPendingChanges: false si todo está synced", () => {
    expect(hasPendingChanges(game({ scores: { k: { strokes: 4, putts: null, syncStatus: "synced", updatedAt: 0 } } }))).toBe(false);
  });

  it("hasSyncErrors: true si algún Score quedó en error", () => {
    expect(hasSyncErrors(game({ scores: { k: { strokes: 4, putts: null, syncStatus: "error", updatedAt: 0 } } }))).toBe(true);
  });

  it("hasSyncErrors: true si la finalización quedó en error", () => {
    expect(hasSyncErrors(game({ finishSyncStatus: "error" }))).toBe(true);
  });
});
