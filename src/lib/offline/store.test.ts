import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalGame } from "./types";

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

const { saveLocalGame, loadLocalGame, getActiveLocalGameId, clearLocalGame } = await import("./store");

function game(gameId: string): LocalGame {
  return {
    gameId,
    course: "Campo de pruebas",
    totalHoles: 1,
    teeCourseRating: null,
    teeSlope: null,
    teeParTotal: null,
    teeHoleCount: null,
    handicapAllowance: null,
    holes: [],
    players: [],
    scores: {},
    localStatus: "active",
    finishSyncStatus: "idle",
    snapshotSavedAt: 0,
    lastSyncAttemptAt: null,
  };
}

describe("offline store — Capacitor Preferences (mock)", () => {
  beforeEach(() => memory.clear());

  it("guarda y recupera un LocalGame tal cual (round-trip)", async () => {
    await saveLocalGame(game("g1"));
    const loaded = await loadLocalGame("g1");
    expect(loaded).toEqual(game("g1"));
  });

  it("sin nada guardado, devuelve null (nunca lanza)", async () => {
    expect(await loadLocalGame("no-existe")).toBeNull();
  });

  it("guardar una partida la marca como la partida activa", async () => {
    await saveLocalGame(game("g1"));
    expect(await getActiveLocalGameId()).toBe("g1");
  });

  it("clearLocalGame borra el snapshot y, si era la activa, también la marca de activa", async () => {
    await saveLocalGame(game("g1"));
    await clearLocalGame("g1");
    expect(await loadLocalGame("g1")).toBeNull();
    expect(await getActiveLocalGameId()).toBeNull();
  });

  it("clearLocalGame de una partida que NO es la activa no toca la marca de activa", async () => {
    await saveLocalGame(game("g1"));
    await saveLocalGame(game("g2")); // g2 pasa a ser la activa
    await clearLocalGame("g1");
    expect(await getActiveLocalGameId()).toBe("g2");
  });
});
