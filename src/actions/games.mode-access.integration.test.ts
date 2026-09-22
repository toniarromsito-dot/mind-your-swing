import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { GameMode } from "@prisma/client";

/**
 * Fase 11A — hardening de monetización: validación server-side de modos
 * Pro (createGame/createRematch) + rate limiting de operaciones costosas
 * (createGame/finishGame/submitSwingVideo/upload de swing). Integración
 * con DB real, mismo patrón que games.invite.integration.test.ts.
 */

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", url });
  }),
}));
// finishGame usa after() (next/server) para el insight/memoria de Claude tras
// responder — fuera de una request real de Next.js no hay "request scope" al
// que enganchar eso (ver Fase 9). Se mockea como no-op.
vi.mock("next/server", () => ({ after: vi.fn() }));

const { createGame, createRematch, finishGame } = await import("@/actions/games");
const { submitSwingVideo } = await import("@/actions/swing-videos");

async function runIgnoringRedirect(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as { digest?: string })?.digest !== "NEXT_REDIRECT") throw e;
  }
}

const PLAYER_COUNT_FOR_MODE: Record<GameMode, number> = {
  SOLO: 1,
  STROKE_PLAY: 2,
  MATCH_PLAY: 2,
  DUEL: 2,
  FRIENDLY_CHALLENGE: 2,
  EVERYONE_VS_EVERYONE: 3,
  POINTS: 3,
  TWO_VS_TWO: 4,
  BEST_BALL: 4,
  SCRAMBLE: 4,
  TEAM_DUEL: 4,
};
const PRO_MODES: GameMode[] = ["DUEL", "FRIENDLY_CHALLENGE", "BEST_BALL", "SCRAMBLE", "TEAM_DUEL"];
const FREE_MODES: GameMode[] = ["SOLO", "STROKE_PLAY", "MATCH_PLAY", "EVERYONE_VS_EVERYONE", "POINTS", "TWO_VS_TWO"];

function gameFormData(mode: GameMode, course = "Campo de pruebas") {
  const fd = new FormData();
  fd.set("playerCount", String(PLAYER_COUNT_FOR_MODE[mode]));
  fd.set("mode", mode);
  fd.set("course", course);
  fd.set("date", new Date().toISOString());
  fd.set("holeCount", "18");
  return fd;
}

describe("Fase 11A — bypass de modos Pro cerrado + rate limiting (integración, DB real)", () => {
  const userIds: string[] = [];
  const gameIds: string[] = [];
  const ORIGINAL_OWNER_EMAILS = process.env.OWNER_EMAILS;

  async function makeUser(label: string, plan: "FREE" | "PRO" = "FREE") {
    const user = await prisma.user.create({
      data: { email: `mode-access-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, name: label, plan },
    });
    userIds.push(user.id);
    return user;
  }

  /** Crea una partida IN_PROGRESS directamente por Prisma (sin pasar por createGame, para no consumir su rate limit en los tests que no lo necesitan). */
  async function seedInProgressGame(ownerId: string, mode: GameMode = "SOLO") {
    const game = await prisma.game.create({
      data: {
        course: "Campo de pruebas",
        mode,
        date: new Date(),
        totalHoles: 1,
        status: "IN_PROGRESS",
        inviteCode: `mode-access-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    gameIds.push(game.id);
    await prisma.hole.create({ data: { gameId: game.id, number: 1, par: 4, index: 1 } });
    await prisma.gamePlayer.create({ data: { gameId: game.id, userId: ownerId } });
    return game;
  }

  afterEach(() => {
    process.env.OWNER_EMAILS = ORIGINAL_OWNER_EMAILS;
  });

  afterAll(async () => {
    await prisma.score.deleteMany({ where: { hole: { gameId: { in: gameIds } } } });
    await prisma.hole.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.gamePlayer.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("A. un usuario FREE no puede crear ninguno de los modos marcados como Pro", async () => {
    const free = await makeUser("a-free");
    userId = free.id;

    for (const mode of PRO_MODES) {
      const result = await createGame(undefined, gameFormData(mode));
      expect(result?.error).toMatch(/pro/i);
    }

    const created = await prisma.game.count({ where: { players: { some: { userId: free.id } } } });
    expect(created).toBe(0); // ninguno de los 5 intentos creó nada
  });

  it("B. un usuario PRO puede crear cada uno de los modos Pro", async () => {
    const pro = await makeUser("b-pro", "PRO");
    userId = pro.id;

    for (const mode of PRO_MODES) {
      await runIgnoringRedirect(() => createGame(undefined, gameFormData(mode)));
      const game = await prisma.game.findFirstOrThrow({
        where: { players: { some: { userId: pro.id } }, mode },
        orderBy: { createdAt: "desc" },
      });
      gameIds.push(game.id);
      expect(game.mode).toBe(mode);
    }
  });

  it("C. un usuario FREE puede seguir creando cualquier modo FREE con normalidad", async () => {
    // Un usuario nuevo por modo: FREE_MODES tiene 6 entradas y el límite de
    // createGame es 5/10min — esto prueba cada modo de forma aislada, no el
    // rate limit (que ya tiene su propio test, H).
    for (const mode of FREE_MODES) {
      const free = await makeUser(`c-free-${mode}`);
      userId = free.id;
      await runIgnoringRedirect(() => createGame(undefined, gameFormData(mode)));
      const game = await prisma.game.findFirstOrThrow({
        where: { players: { some: { userId: free.id } }, mode },
        orderBy: { createdAt: "desc" },
      });
      gameIds.push(game.id);
      expect(game.mode).toBe(mode);
    }
  });

  it("D. createRematch de una partida en modo Pro pedida por un usuario FREE es rechazado", async () => {
    const free = await makeUser("d-free");
    const source = await seedInProgressGame(free.id, "SCRAMBLE");
    userId = free.id;

    await expect(createRematch(source.id)).rejects.toThrow(/pro/i);

    const totalGamesForUser = await prisma.game.count({ where: { players: { some: { userId: free.id } } } });
    expect(totalGamesForUser).toBe(1); // solo la original — la revancha nunca se creó
  });

  it("E. createRematch de una partida en modo FREE se permite con normalidad", async () => {
    const free = await makeUser("e-free");
    const source = await seedInProgressGame(free.id, "SOLO");
    userId = free.id;

    await runIgnoringRedirect(() => createRematch(source.id));

    const rematch = await prisma.game.findFirstOrThrow({
      where: { players: { some: { userId: free.id } }, id: { not: source.id } },
    });
    gameIds.push(rematch.id);
    expect(rematch.mode).toBe("SOLO");
  });

  it("F. finishGame está protegido frente a llamadas repetidas/excesivas (5 permitidas, 6ª rechazada)", async () => {
    const user = await makeUser("f-finisher");
    const games = await Promise.all(Array.from({ length: 6 }, () => seedInProgressGame(user.id)));

    // Las primeras 5 (límite configurado) terminan con normalidad.
    for (const game of games.slice(0, 5)) {
      userId = user.id;
      await finishGame(game.id);
      const after = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
      expect(after.status).toBe("COMPLETED");
    }

    // La 6ª, dentro de la misma ventana, se rechaza por rate limit — nunca llega a tocar el estado de la partida.
    const sixth = games[5];
    await expect(finishGame(sixth.id)).rejects.toThrow(/rápido/i);
    const stillOpen = await prisma.game.findUniqueOrThrow({ where: { id: sixth.id } });
    expect(stillOpen.status).toBe("IN_PROGRESS");
  });

  it("G. submitSwingVideo mantiene su protección PRO y además aplica un rate limit propio", async () => {
    const free = await makeUser("g-free");
    userId = free.id;
    const freeResult = await submitSwingVideo({ videoUrl: "https://example.com/swing.mp4", poseFrames: [] });
    expect(freeResult).toEqual({ error: dictionaries.es.swingVideos.proRequiredError });

    const pro = await makeUser("g-pro", "PRO");
    userId = pro.id;

    // Las primeras 5 (límite configurado) pasan el gate Pro y el rate
    // limit, y fallan más adelante por falta de datos de pose reales
    // (poseFrames vacío a propósito — no hace falta un vídeo real para
    // probar la protección de plan/límite).
    for (let i = 0; i < 5; i++) {
      const result = await submitSwingVideo({ videoUrl: "https://example.com/swing.mp4", poseFrames: [] });
      expect("error" in result ? result.error : "").toMatch(/fotogramas/i);
    }

    // El 6º intento, dentro de la misma ventana, se rechaza por rate limit.
    const sixth = await submitSwingVideo({ videoUrl: "https://example.com/swing.mp4", poseFrames: [] });
    expect(sixth).toEqual({ error: dictionaries.es.swingVideos.rateLimitError });

    const videosStored = await prisma.swingVideo.count({ where: { userId: pro.id } });
    expect(videosStored).toBe(0); // ninguno de los intentos (fallidos) creó una fila
  });

  it("H. el rate limit de un usuario nunca consume el presupuesto de otro usuario", async () => {
    const userA = await makeUser("h-a");
    const userB = await makeUser("h-b");

    // Usuario A agota su propio límite de creación (5 en la ventana).
    userId = userA.id;
    for (let i = 0; i < 5; i++) {
      await runIgnoringRedirect(() => createGame(undefined, gameFormData("SOLO")));
    }
    const sixthForA = await createGame(undefined, gameFormData("SOLO"));
    expect(sixthForA?.error).toMatch(/rápido/i);

    const aGames = await prisma.game.findMany({ where: { players: { some: { userId: userA.id } } } });
    gameIds.push(...aGames.map((g) => g.id));
    expect(aGames).toHaveLength(5); // el 6º intento no creó nada

    // Usuario B, sin haber tocado nada todavía, crea su primera partida con normalidad.
    userId = userB.id;
    await runIgnoringRedirect(() => createGame(undefined, gameFormData("SOLO")));
    const bGame = await prisma.game.findFirstOrThrow({ where: { players: { some: { userId: userB.id } } } });
    gameIds.push(bGame.id);
    expect(bGame).toBeTruthy(); // B no heredó el bloqueo de A
  });

  it("I. la cuenta OWNER sigue pudiendo crear modos Pro vía hasProAccess, sin necesidad de plan PRO en BD", async () => {
    const owner = await makeUser("i-owner", "FREE"); // FREE en BD a propósito: el acceso viene de OWNER_EMAILS, no de Stripe
    process.env.OWNER_EMAILS = owner.email;
    userId = owner.id;

    await runIgnoringRedirect(() => createGame(undefined, gameFormData("SCRAMBLE")));

    const game = await prisma.game.findFirstOrThrow({ where: { players: { some: { userId: owner.id } } } });
    gameIds.push(game.id);
    expect(game.mode).toBe("SCRAMBLE");
  });

  it("J. una partida normal (modo FREE, flujo completo crear → finalizar) sigue funcionando sin fricción", async () => {
    const user = await makeUser("j-normal");
    userId = user.id;

    await runIgnoringRedirect(() => createGame(undefined, gameFormData("STROKE_PLAY")));
    const game = await prisma.game.findFirstOrThrow({ where: { players: { some: { userId: user.id } }, mode: "STROKE_PLAY" } });
    gameIds.push(game.id);
    expect(game.status).toBe("IN_PROGRESS");

    await finishGame(game.id);
    const finished = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(finished.status).toBe("COMPLETED");
  });
});
