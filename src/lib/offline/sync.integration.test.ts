import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { scoreKey, type LocalGame } from "./types";

let sessionUserId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: sessionUserId } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// finishGame() usa after() (next/server) para el insight/memoria de Claude
// tras responder — fuera de una request real de Next.js (como aquí, un
// test llamando a la Server Action directamente) no hay "request scope" al
// que enganchar eso. Se mockea como no-op: no hace falta que el análisis
// de IA corra en el test, solo que Game.status quede COMPLETED.
vi.mock("next/server", () => ({ after: vi.fn() }));

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

const { saveLocalGame, loadLocalGame } = await import("./store");
const { syncPendingScores, syncFinish, syncGame } = await import("./sync");
const { finishGame } = await import("@/actions/games");

describe("Offline sync — contra Server Actions y base de datos reales (integración)", () => {
  const userIds: string[] = [];
  const gameIds: string[] = [];

  afterEach(() => {
    memory.clear();
  });

  afterAll(async () => {
    await prisma.score.deleteMany({ where: { hole: { gameId: { in: gameIds } } } });
    await prisma.gamePlayer.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.hole.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(name: string) {
    const user = await prisma.user.create({ data: { email: `offline-sync-${Date.now()}-${Math.random()}@example.com`, name } });
    userIds.push(user.id);
    return user;
  }

  async function makeGame(ownerId: string) {
    const game = await prisma.game.create({
      data: {
        course: "Campo de pruebas",
        mode: "SOLO",
        date: new Date(),
        totalHoles: 1,
        inviteCode: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    gameIds.push(game.id);
    const hole = await prisma.hole.create({ data: { gameId: game.id, number: 1, par: 4, index: 1 } });
    const player = await prisma.gamePlayer.create({ data: { gameId: game.id, userId: ownerId } });
    return { game, hole, player };
  }

  function baseLocalGame(gameId: string, holeId: string, playerId: string, userId: string): LocalGame {
    return {
      gameId,
      course: "Campo de pruebas",
      totalHoles: 1,
      teeCourseRating: null,
      teeSlope: null,
      teeParTotal: null,
      teeHoleCount: null,
      handicapAllowance: null,
      holes: [{ id: holeId, number: 1, par: 4, distance: null, index: 1 }],
      players: [{ id: playerId, userId, name: "Jugador", image: null, playingHandicap: null, userHandicap: null }],
      scores: {},
      localStatus: "active",
      finishSyncStatus: "idle",
      snapshotSavedAt: 0,
      lastSyncAttemptAt: null,
    };
  }

  it("sincroniza un Score pendiente real: aparece en la base de datos y queda 'synced' localmente", async () => {
    const owner = await makeUser("Jugador Offline");
    const { game, hole, player } = await makeGame(owner.id);
    sessionUserId = owner.id;

    await saveLocalGame({
      ...baseLocalGame(game.id, hole.id, player.id, owner.id),
      scores: { [scoreKey(hole.id, player.id)]: { strokes: 5, putts: 2, syncStatus: "pending", updatedAt: Date.now() } },
    });

    const result = await syncPendingScores(game.id);
    expect(result).toEqual({ syncedScores: 1, failedScores: 0 });

    const dbScore = await prisma.score.findUnique({ where: { holeId_playerId: { holeId: hole.id, playerId: player.id } } });
    expect(dbScore?.strokes).toBe(5);
    expect(dbScore?.putts).toBe(2);

    const local = await loadLocalGame(game.id);
    expect(local!.scores[scoreKey(hole.id, player.id)].syncStatus).toBe("synced");
  });

  it("OWNERSHIP real: si la sesión no pertenece a la partida, el rechazo real del servidor marca el Score como 'error', no como 'pending' eterno", async () => {
    const owner = await makeUser("Dueño Real");
    const outsider = await makeUser("Sin Pertenencia");
    const { game, hole, player } = await makeGame(owner.id);

    // El local dice que este jugador es "player" (de otra sesión) pero
    // quien realmente sincroniza es `outsider` — simula una cola offline
    // con datos que ya no corresponden a quien está autenticado ahora.
    sessionUserId = outsider.id;
    await saveLocalGame({
      ...baseLocalGame(game.id, hole.id, player.id, owner.id),
      scores: { [scoreKey(hole.id, player.id)]: { strokes: 7, putts: null, syncStatus: "pending", updatedAt: Date.now() } },
    });

    const result = await syncPendingScores(game.id);
    expect(result).toEqual({ syncedScores: 0, failedScores: 1 });

    const local = await loadLocalGame(game.id);
    const entry = local!.scores[scoreKey(hole.id, player.id)];
    expect(entry.syncStatus).toBe("error");
    expect(entry.errorReason).toMatch(/no perteneces/i);

    const dbScore = await prisma.score.findUnique({ where: { holeId_playerId: { holeId: hole.id, playerId: player.id } } });
    expect(dbScore).toBeNull(); // nunca se escribió nada en la base de datos
  });

  it("DUPLICADOS: sincronizar el mismo Score dos veces (reintento tras no saber si el primero llegó) no crea una segunda fila", async () => {
    const owner = await makeUser("Doble Sync");
    const { game, hole, player } = await makeGame(owner.id);
    sessionUserId = owner.id;

    await saveLocalGame({
      ...baseLocalGame(game.id, hole.id, player.id, owner.id),
      scores: { [scoreKey(hole.id, player.id)]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: Date.now() } },
    });
    await syncPendingScores(game.id);

    // Se marca de nuevo como pending (como si el cliente no supiera si el
    // primer intento confirmó) y se reintenta.
    const afterFirst = await loadLocalGame(game.id);
    await saveLocalGame({
      ...afterFirst!,
      scores: { [scoreKey(hole.id, player.id)]: { ...afterFirst!.scores[scoreKey(hole.id, player.id)], syncStatus: "pending" } },
    });
    const secondResult = await syncPendingScores(game.id);
    expect(secondResult).toEqual({ syncedScores: 1, failedScores: 0 });

    const allScores = await prisma.score.findMany({ where: { holeId: hole.id, playerId: player.id } });
    expect(allScores).toHaveLength(1); // nunca una segunda fila — @@unique([holeId, playerId]) + upsert
    expect(allScores[0].strokes).toBe(4);
  });

  it("FINISH IDEMPOTENTE: llamar a finishGame dos veces para la misma partida no falla ni duplica efectos", async () => {
    const owner = await makeUser("Finaliza Dos Veces");
    const { game } = await makeGame(owner.id);
    sessionUserId = owner.id;

    await saveLocalGame({
      ...baseLocalGame(game.id, "hole-x", "player-x", owner.id),
      localStatus: "completed_pending_sync",
      finishSyncStatus: "pending",
    });

    const first = await syncFinish(game.id);
    expect(first).toEqual({ finishSynced: true, finishFailed: false });

    const gameAfterFirst = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(gameAfterFirst.status).toBe("COMPLETED");

    // Segunda llamada directa a la Server Action real (simula un reintento
    // que no sabía que el primero ya había confirmado) — no debe lanzar.
    await expect(finishGame(game.id)).resolves.toBeUndefined();

    const gameAfterSecond = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(gameAfterSecond.status).toBe("COMPLETED");
  });

  it("BLOQUEO REAL: un Score en 'error' impide finishGame — el servidor nunca marca COMPLETED con un hoyo sin confirmar (Fase de corrección, punto 2)", async () => {
    const owner = await makeUser("Bloqueo Por Error");
    const { game, hole, player } = await makeGame(owner.id);
    sessionUserId = owner.id;

    await saveLocalGame({
      ...baseLocalGame(game.id, hole.id, player.id, owner.id),
      scores: {
        [scoreKey(hole.id, player.id)]: {
          strokes: 4,
          putts: null,
          syncStatus: "error",
          updatedAt: Date.now(),
          errorReason: "Datos inválidos",
        },
      },
      localStatus: "completed_pending_sync",
      finishSyncStatus: "pending",
    });

    const result = await syncGame(game.id);
    expect(result.finishCompleted).toBe(false);
    expect(result.scoresSynced).toBe(false);

    const gameAfter = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(gameAfter.status).toBe("IN_PROGRESS"); // nunca COMPLETED con un Score que el servidor no confirmó

    const local = await loadLocalGame(game.id);
    expect(local).not.toBeNull(); // no se limpia: la partida sigue protegida localmente
    expect(local!.finishSyncStatus).toBe("pending"); // se conserva la intención de finalizar
  });

  it("syncGame limpia el snapshot local una vez todo está confirmado por el servidor", async () => {
    const owner = await makeUser("Todo Sincronizado");
    const { game, hole, player } = await makeGame(owner.id);
    sessionUserId = owner.id;

    await saveLocalGame({
      ...baseLocalGame(game.id, hole.id, player.id, owner.id),
      scores: { [scoreKey(hole.id, player.id)]: { strokes: 4, putts: null, syncStatus: "pending", updatedAt: Date.now() } },
      localStatus: "completed_pending_sync",
      finishSyncStatus: "pending",
    });

    await syncGame(game.id);

    const local = await loadLocalGame(game.id);
    expect(local).toBeNull(); // limpiado: ya no hace falta protección offline para esta partida
  });
});
