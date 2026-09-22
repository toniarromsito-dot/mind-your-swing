import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { gamePlayingHandicapForIndex } from "@/lib/games/handicap";

// Santa Ponsa III, tee de 9 hoyos reales con Course Rating/Slope
// verificados (FBGolf) — usado para los tests de hándicap decimal de esta
// sección (Regla 6.1b: sin redondeo intermedio de HI/2).
const SANTA_PONSA_III_9_HOLES = [
  { number: 1, par: 4, index: 5, distance: 320 },
  { number: 2, par: 3, index: 9, distance: 130 },
  { number: 3, par: 5, index: 1, distance: 460 },
  { number: 4, par: 4, index: 7, distance: 300 },
  { number: 5, par: 3, index: 3, distance: 150 },
  { number: 6, par: 4, index: 11, distance: 290 },
  { number: 7, par: 4, index: 13, distance: 280 },
  { number: 8, par: 4, index: 15, distance: 270 },
  { number: 9, par: 3, index: 17, distance: 140 },
];

// Golf Alcanada, tee AMARILLAS (M) — datos reales verificados (CR 72.4,
// Slope 135, Par 72) y su tarjeta hoyo a hoyo real, ya usados en
// handicap.test.ts. Aquí se crean como fixture propio (no se depende de
// que la base de pruebas tenga cargado el dataset de Mallorca).
const ALCANADA_AMARILLAS_M_HOLES = [
  { number: 1, par: 5, index: 11, distance: 450 },
  { number: 2, par: 4, index: 4, distance: 368 },
  { number: 3, par: 4, index: 12, distance: 314 },
  { number: 4, par: 3, index: 16, distance: 160 },
  { number: 5, par: 4, index: 7, distance: 353 },
  { number: 6, par: 3, index: 17, distance: 137 },
  { number: 7, par: 5, index: 3, distance: 561 },
  { number: 8, par: 4, index: 1, distance: 398 },
  { number: 9, par: 4, index: 5, distance: 374 },
  { number: 10, par: 4, index: 10, distance: 348 },
  { number: 11, par: 5, index: 6, distance: 535 },
  { number: 12, par: 4, index: 8, distance: 324 },
  { number: 13, par: 5, index: 18, distance: 492 },
  { number: 14, par: 3, index: 14, distance: 145 },
  { number: 15, par: 4, index: 13, distance: 297 },
  { number: 16, par: 4, index: 2, distance: 418 },
  { number: 17, par: 3, index: 9, distance: 194 },
  { number: 18, par: 4, index: 15, distance: 325 },
];

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: userId } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" });
  }),
}));

const { createGame, createRematch, joinGame } = await import("@/actions/games");

async function runIgnoringRedirect(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as { digest?: string })?.digest !== "NEXT_REDIRECT") throw e;
  }
}

function createGameFormData(opts: {
  courseId: string;
  courseLayoutId: string;
  courseTeeId: string;
  holeCount: 9 | 18;
  playerIds?: string[];
  playerCount?: number;
}) {
  const fd = new FormData();
  const playerCount = opts.playerCount ?? 1 + (opts.playerIds?.length ?? 0);
  fd.set("playerCount", String(playerCount));
  // STROKE_PLAY (no DUEL): modo gratuito — este archivo prueba el snapshot de
  // hándicap, no el bypass de modos Pro (ver games.mode-access.integration.test.ts,
  // Fase 11A), y el creador de estos fixtures no tiene por qué tener plan Pro.
  fd.set("mode", playerCount > 1 ? "STROKE_PLAY" : "SOLO");
  fd.set("courseId", opts.courseId);
  fd.set("courseLayoutId", opts.courseLayoutId);
  fd.set("courseTeeId", opts.courseTeeId);
  fd.set("date", new Date().toISOString());
  fd.set("holeCount", String(opts.holeCount));
  for (const id of opts.playerIds ?? []) fd.append("playerIds", id);
  return fd;
}

describe("Snapshot de hándicap en Game y createRematch (integración, DB real)", () => {
  const createdCourseIds: string[] = [];
  const createdGameIds: string[] = [];
  let secondUserId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `handicap-snapshot-${Date.now()}@example.com`, name: "Handicap Tester", handicap: 14 },
    });
    userId = user.id;
    const second = await prisma.user.create({
      data: { email: `handicap-snapshot-2-${Date.now()}@example.com`, name: "Second Player", handicap: 8 },
    });
    secondUserId = second.id;
  });

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
    await prisma.golfCourse.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.user.delete({ where: { id: secondUserId } });
    await prisma.$disconnect();
  });

  async function makeSantaPonsaTee(suffixLabel: string) {
    const suffix = `${Date.now()}-${suffixLabel}-${Math.random().toString(36).slice(2, 8)}`;
    const course = await prisma.golfCourse.create({
      data: { name: "Santa Ponsa III (test)", slug: `test-santa-ponsa-${suffix}`, island: "Test", country: "Test" },
    });
    createdCourseIds.push(course.id);
    const layout = await prisma.golfCourseLayout.create({ data: { courseId: course.id, name: "III", holeCount: 9 } });
    const tee = await prisma.golfCourseTee.create({
      data: {
        layoutId: layout.id,
        name: "AMARILLAS",
        category: "M",
        parTotal: 30,
        distanceTotal: 2340,
        courseRating: 29.6,
        slope: 101,
        holes: { create: SANTA_PONSA_III_9_HOLES },
      },
    });
    return { course, layout, tee };
  }

  async function makeAlcanadaTee(suffixLabel: string) {
    const suffix = `${Date.now()}-${suffixLabel}-${Math.random().toString(36).slice(2, 8)}`;
    const course = await prisma.golfCourse.create({
      data: { name: "Alcanada (test)", slug: `test-alcanada-${suffix}`, island: "Test", country: "Test" },
    });
    createdCourseIds.push(course.id);
    const layout = await prisma.golfCourseLayout.create({ data: { courseId: course.id, name: "Alcanada", holeCount: 18 } });
    const tee = await prisma.golfCourseTee.create({
      data: {
        layoutId: layout.id,
        name: "AMARILLAS",
        category: "M",
        parTotal: 72,
        distanceTotal: 6193,
        courseRating: 72.4,
        slope: 135,
        holes: { create: ALCANADA_AMARILLAS_M_HOLES },
      },
    });
    return { course, layout, tee };
  }

  it("15. Al crear un Game se guarda una foto del Handicap Index/Course Handicap/Playing Handicap del creador", async () => {
    const { course, layout, tee } = await makeAlcanadaTee("snapshot");

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );

    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id } });
    createdGameIds.push(game.id);

    expect(game.handicapIndex).toBe(14);
    expect(game.courseHandicap).toBe(17); // round(14 * 135/113 + (72.4-72)) = 17
    expect(game.playingHandicap).toBe(17); // allowance 100% esta fase
    expect(game.handicapAllowance).toBe(1);
    expect(game.teeCourseRating).toBe(72.4);
    expect(game.teeSlope).toBe(135);
    expect(game.teeParTotal).toBe(72);
    expect(game.teeHoleCount).toBe(18);
  });

  it("17. createRematch recalcula el hándicap con el Handicap Index ACTUAL de quien pide la revancha, sin tocar la partida original", async () => {
    const { course, layout, tee } = await makeAlcanadaTee("rematch");

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );
    const original = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id } });
    createdGameIds.push(original.id);
    expect(original.handicapIndex).toBe(14);
    expect(original.playingHandicap).toBe(17);

    // El jugador actualiza su Handicap Index declarado antes de la revancha.
    await prisma.user.update({ where: { id: userId }, data: { handicap: 8 } });

    await runIgnoringRedirect(() => createRematch(original.id));

    const rematch = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id, id: { not: original.id } } });
    createdGameIds.push(rematch.id);

    // Rematch: Course Handicap = round(8 * 135/113 + 0.4) = round(9.5575 + 0.4) = round(9.9575) = 10
    expect(rematch.handicapIndex).toBe(8);
    expect(rematch.courseHandicap).toBe(10);
    expect(rematch.playingHandicap).toBe(10);

    // La partida original conserva su propia foto, sin cambios.
    const originalAfter = await prisma.game.findUniqueOrThrow({ where: { id: original.id } });
    expect(originalAfter.handicapIndex).toBe(14);
    expect(originalAfter.playingHandicap).toBe(17);
  });

  it("18. Una partida existente creada sin los campos de esta fase (legacy) sigue funcionando y no fabrica un hándicap", async () => {
    // Simula una partida creada ANTES de esta migración: courseTeeId/campos
    // de hándicap todos null, exactamente como quedan por defecto en una
    // fila ya existente tras una migración aditiva.
    const legacyGame = await prisma.game.create({
      data: {
        course: "Campo de prueba (legacy)",
        mode: "SOLO",
        date: new Date(),
        inviteCode: `legacy-hcp-${Date.now()}`,
        totalHoles: 3,
        holes: { create: [{ number: 1, par: 4 }, { number: 2, par: 3 }, { number: 3, par: 5 }] },
        players: { create: { userId } },
      },
      include: { holes: true },
    });
    createdGameIds.push(legacyGame.id);

    expect(legacyGame.courseTeeId).toBeNull();
    expect(legacyGame.handicapIndex).toBeNull();
    expect(legacyGame.playingHandicap).toBeNull();

    // gamePlayingHandicapForIndex nunca fabrica un número: null en vez de crashear.
    expect(gamePlayingHandicapForIndex(legacyGame, 14)).toBeNull();

    // Sus hoyos siguen exactamente igual (3 hoyos, pares originales) — nada
    // de esta fase los ha tocado.
    const holesAfter = await prisma.hole.findMany({ where: { gameId: legacyGame.id }, orderBy: { number: "asc" } });
    expect(holesAfter.map((h) => h.par)).toEqual([4, 3, 5]);
  });

  it("19. Handicap Index decimal (37,3) en un recorrido de 9 hoyos reales: Course Handicap 16 a 9 hoyos, 33 a 18 (fórmulas distintas, sin redondeo intermedio de HI/2)", async () => {
    const { course, layout, tee } = await makeSantaPonsaTee("decimal-9");
    await prisma.user.update({ where: { id: userId }, data: { handicap: 37.3 } });

    try {
      await runIgnoringRedirect(() =>
        createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 9 }))
      );
      const nineHoleGame = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id, totalHoles: 9 }, include: { players: true } });
      createdGameIds.push(nineHoleGame.id);
      expect(nineHoleGame.handicapIndex).toBe(37.3);
      expect(nineHoleGame.courseHandicap).toBe(16);
      expect(nineHoleGame.players[0].handicapIndex).toBe(37.3);
      expect(nineHoleGame.players[0].courseHandicap).toBe(16);
      expect(nineHoleGame.players[0].playingHandicap).toBe(16);

      await runIgnoringRedirect(() =>
        createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
      );
      const eighteenHoleGame = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id, totalHoles: 18 }, include: { players: true } });
      createdGameIds.push(eighteenHoleGame.id);
      // Vuelta de 18 sobre el mismo recorrido de 9: fórmula DISTINTA (Regla
      // 6.1a nota 1, HI completo) — nunca el mismo Course Handicap que a 9.
      expect(eighteenHoleGame.courseHandicap).toBe(33);
      expect(eighteenHoleGame.players[0].courseHandicap).toBe(33);
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { handicap: 14 } });
    }
  });

  it("20. Un segundo jugador guarda su PROPIA foto de hándicap en GamePlayer — no la del creador aplicada a todos", async () => {
    const { course, layout, tee } = await makeAlcanadaTee("two-players");

    await runIgnoringRedirect(() =>
      createGame(
        undefined,
        createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18, playerIds: [secondUserId] })
      )
    );
    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { players: true } });
    createdGameIds.push(game.id);

    const creatorPlayer = game.players.find((p) => p.userId === userId)!;
    const secondPlayer = game.players.find((p) => p.userId === secondUserId)!;

    // Creador: HI 14 -> Course/Playing Handicap 17 (igual que el test 15).
    expect(creatorPlayer.handicapIndex).toBe(14);
    expect(creatorPlayer.playingHandicap).toBe(17);
    // Segundo jugador: HI 8 -> round(8 * 135/113 + 0.4) = round(9.9575) = 10 — NUNCA el 17 del creador.
    expect(secondPlayer.handicapIndex).toBe(8);
    expect(secondPlayer.courseHandicap).toBe(10);
    expect(secondPlayer.playingHandicap).toBe(10);
  });

  it("21. Cambiar el Handicap Index del usuario DESPUÉS de crear la partida no modifica la foto ya guardada en GamePlayer", async () => {
    const { course, layout, tee } = await makeAlcanadaTee("post-change");

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );
    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { players: true } });
    createdGameIds.push(game.id);
    const originalPlayer = game.players.find((p) => p.userId === userId)!;
    expect(originalPlayer.playingHandicap).toBe(17);

    try {
      // El jugador actualiza su Handicap Index declarado una semana después.
      await prisma.user.update({ where: { id: userId }, data: { handicap: 35 } });

      const playerAfter = await prisma.gamePlayer.findUniqueOrThrow({ where: { id: originalPlayer.id } });
      expect(playerAfter.handicapIndex).toBe(14);
      expect(playerAfter.playingHandicap).toBe(17);
      // gamePlayingHandicapForIndex con el HI nuevo daría un valor distinto —
      // confirma que la foto guardada, y no un recálculo, es la que se
      // muestra para esta partida antigua.
      expect(gamePlayingHandicapForIndex(game, 35)).not.toBe(playerAfter.playingHandicap);
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { handicap: 14 } });
    }
  });

  it("22. createRematch congela el Handicap Index ACTUAL de CADA jugador en su propio GamePlayer, no solo el de quien pide la revancha", async () => {
    const { course, layout, tee } = await makeAlcanadaTee("rematch-per-player");

    await runIgnoringRedirect(() =>
      createGame(
        undefined,
        createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18, playerIds: [secondUserId] })
      )
    );
    const original = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { players: true } });
    createdGameIds.push(original.id);

    try {
      // Ambos jugadores actualizan su Handicap Index antes de la revancha.
      await prisma.user.update({ where: { id: userId }, data: { handicap: 20 } });
      await prisma.user.update({ where: { id: secondUserId }, data: { handicap: 5 } });

      await runIgnoringRedirect(() => createRematch(original.id));

      const rematch = await prisma.game.findFirstOrThrow({
        where: { courseTeeId: tee.id, id: { not: original.id } },
        include: { players: true },
      });
      createdGameIds.push(rematch.id);

      const rematchCreator = rematch.players.find((p) => p.userId === userId)!;
      const rematchSecond = rematch.players.find((p) => p.userId === secondUserId)!;
      // Solicitante: HI 20 -> round(20 * 135/113 + 0.4) = round(24.28) = 24.
      expect(rematchCreator.handicapIndex).toBe(20);
      expect(rematchCreator.playingHandicap).toBe(24);
      // Segundo jugador: HI 5 -> round(5 * 135/113 + 0.4) = round(6.37) = 6 — su hándicap ACTUAL, no el 8 original ni el 24 del solicitante.
      expect(rematchSecond.handicapIndex).toBe(5);
      expect(rematchSecond.playingHandicap).toBe(6);

      // La partida original conserva la foto original de cada jugador.
      const originalCreatorAfter = await prisma.gamePlayer.findUniqueOrThrow({
        where: { id: original.players.find((p) => p.userId === userId)!.id },
      });
      const originalSecondAfter = await prisma.gamePlayer.findUniqueOrThrow({
        where: { id: original.players.find((p) => p.userId === secondUserId)!.id },
      });
      expect(originalCreatorAfter.playingHandicap).toBe(17);
      expect(originalSecondAfter.playingHandicap).toBe(10);
    } finally {
      await prisma.user.update({ where: { id: userId }, data: { handicap: 14 } });
      await prisma.user.update({ where: { id: secondUserId }, data: { handicap: 8 } });
    }
  });

  it("23. joinGame guarda la foto de hándicap de quien se une, usando el campo/tee ya congelado de la partida", async () => {
    const { course, layout, tee } = await makeAlcanadaTee("join");

    // playerCount 2 sin playerIds: deja hueco para que el segundo jugador
    // se una luego por código de invitación (como joinGame espera).
    await runIgnoringRedirect(() =>
      createGame(
        undefined,
        createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18, playerCount: 2 })
      )
    );
    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id } });
    createdGameIds.push(game.id);

    const previousUserId = userId;
    userId = secondUserId; // joinGame lee la sesión "actual" del mock de auth().
    try {
      await runIgnoringRedirect(() => joinGame(game.inviteCode));
    } finally {
      userId = previousUserId;
    }

    const joinedPlayer = await prisma.gamePlayer.findFirstOrThrow({ where: { gameId: game.id, userId: secondUserId } });
    // Segundo jugador: HI 8 -> Course/Playing Handicap 10 (igual que el test 20), calculado sobre el tee ya congelado en esta partida.
    expect(joinedPlayer.handicapIndex).toBe(8);
    expect(joinedPlayer.courseHandicap).toBe(10);
    expect(joinedPlayer.playingHandicap).toBe(10);
  });

  it("24. GamePlayer legacy (creado antes de esta fase, campos de hándicap en null) no rompe nada — la partida sigue mostrando datos sin fabricar un hándicap para él", async () => {
    const { course, layout, tee } = await makeAlcanadaTee("legacy-player");

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );
    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { players: true } });
    createdGameIds.push(game.id);

    // Simula una fila de GamePlayer creada ANTES de esta migración: se une
    // directamente por prisma, dejando los 4 campos nuevos en su default (null).
    await prisma.gamePlayer.create({ data: { gameId: game.id, userId: secondUserId } });
    const legacyPlayer = await prisma.gamePlayer.findFirstOrThrow({ where: { gameId: game.id, userId: secondUserId } });
    expect(legacyPlayer.playingHandicap).toBeNull();

    // El fallback de lectura en vivo (el mismo que usan game-view.tsx y
    // resumen/page.tsx cuando playingHandicap es null) sigue funcionando
    // con el Game ya congelado y el Handicap Index actual del jugador.
    const secondUser = await prisma.user.findUniqueOrThrow({ where: { id: secondUserId } });
    expect(gamePlayingHandicapForIndex(game, secondUser.handicap)).toBe(10);
  });
});
