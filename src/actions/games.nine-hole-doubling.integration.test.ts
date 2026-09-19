import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// Golpes reales de 9 hoyos (par/índice/distancia distintos por hoyo, para
// poder comprobar que la segunda vuelta clona exactamente los mismos
// valores en vez de repetir uno solo por casualidad).
const NINE_REAL_HOLES = [
  { number: 1, par: 4, index: 7, distance: 320 },
  { number: 2, par: 3, index: 15, distance: 145 },
  { number: 3, par: 5, index: 1, distance: 480 },
  { number: 4, par: 4, index: 11, distance: 300 },
  { number: 5, par: 4, index: 3, distance: 355 },
  { number: 6, par: 3, index: 17, distance: 130 },
  { number: 7, par: 5, index: 5, distance: 470 },
  { number: 8, par: 4, index: 9, distance: 310 },
  { number: 9, par: 4, index: 13, distance: 295 },
];

const EIGHTEEN_REAL_HOLES = Array.from({ length: 18 }, (_, i) => ({
  number: i + 1,
  par: [4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4][i],
  index: ((i * 7) % 18) + 1,
  distance: 280 + i * 5,
}));

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: userId } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT" });
  }),
}));

const { createGame, createRematch } = await import("@/actions/games");

async function runIgnoringRedirect(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as { digest?: string })?.digest !== "NEXT_REDIRECT") throw e;
  }
}

async function makeCourseWithTee(courseName: string, layoutName: string, holeCount: 9 | 18, holes: typeof NINE_REAL_HOLES) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const course = await prisma.golfCourse.create({
    data: { name: courseName, slug: `test-${suffix}`, island: "Test", country: "Test" },
  });
  const layout = await prisma.golfCourseLayout.create({
    data: { courseId: course.id, name: layoutName, holeCount },
  });
  const tee = await prisma.golfCourseTee.create({
    data: {
      layoutId: layout.id,
      name: "TEST",
      category: "M",
      parTotal: holes.reduce((s, h) => s + h.par, 0),
      distanceTotal: holes.reduce((s, h) => s + h.distance, 0),
      courseRating: 70.1,
      slope: 125,
      holes: { create: holes },
    },
  });
  return { course, layout, tee };
}

function createGameFormData(opts: { courseId: string; courseLayoutId: string; courseTeeId: string; holeCount: 9 | 18 }) {
  const fd = new FormData();
  fd.set("playerCount", "1");
  fd.set("mode", "SOLO");
  fd.set("courseId", opts.courseId);
  fd.set("courseLayoutId", opts.courseLayoutId);
  fd.set("courseTeeId", opts.courseTeeId);
  fd.set("date", new Date().toISOString());
  fd.set("holeCount", String(opts.holeCount));
  return fd;
}

describe("createGame / createRematch — recorridos de 9 hoyos jugados a 18 (integración, DB real)", () => {
  const createdCourseIds: string[] = [];
  const createdGameIds: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `nine-hole-doubling-${Date.now()}@example.com`, name: "Nine Hole Tester" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
    await prisma.golfCourse.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("1. Pollença a 9 hoyos -> 9 GameHole, sin duplicar", async () => {
    const { course, layout, tee } = await makeCourseWithTee("Golf Pollença (test)", "Pollença", 9, NINE_REAL_HOLES);
    createdCourseIds.push(course.id);

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 9 }))
    );

    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { holes: { orderBy: { number: "asc" } } } });
    createdGameIds.push(game.id);

    expect(game.holes).toHaveLength(9);
    expect(game.totalHoles).toBe(9);
    expect(game.holes.map((h) => h.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("2. Pollença a 18 hoyos -> 18 GameHole (segunda vuelta clona la primera)", async () => {
    const { course, layout, tee } = await makeCourseWithTee("Golf Pollença (test 18)", "Pollença", 9, NINE_REAL_HOLES);
    createdCourseIds.push(course.id);

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );

    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { holes: { orderBy: { number: "asc" } } } });
    createdGameIds.push(game.id);

    expect(game.holes).toHaveLength(18);
    expect(game.totalHoles).toBe(18);
    expect(game.holes.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));

    // GameHole 10-18 (segunda vuelta) tienen exactamente los mismos datos del tee real que 1-9.
    for (let i = 0; i < 9; i++) {
      const first = game.holes[i];
      const second = game.holes[i + 9];
      expect(second.par).toBe(first.par);
      expect(second.index).toBe(first.index);
      expect(second.distance).toBe(first.distance);
    }
  });

  it("3. Santa Ponsa III a 18 hoyos -> 18 GameHole", async () => {
    const { course, layout, tee } = await makeCourseWithTee("Golf Santa Ponsa (test III)", "Santa Ponsa III", 9, NINE_REAL_HOLES);
    createdCourseIds.push(course.id);

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );

    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { holes: true } });
    createdGameIds.push(game.id);
    expect(game.holes).toHaveLength(18);
  });

  it("4. Palma Pitch & Putt a 18 hoyos -> 18 GameHole", async () => {
    const { course, layout, tee } = await makeCourseWithTee("Palma Pitch & Putt (test)", "Palma Pitch & Putt", 9, NINE_REAL_HOLES);
    createdCourseIds.push(course.id);

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );

    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { holes: true } });
    createdGameIds.push(game.id);
    expect(game.holes).toHaveLength(18);
  });

  it("5. Recorrido normal de 18 hoyos reales a 18 -> 18 GameHole SIN duplicación", async () => {
    const { course, layout, tee } = await makeCourseWithTee("Golf Normal (test 18)", "Recorrido 18", 18, EIGHTEEN_REAL_HOLES);
    createdCourseIds.push(course.id);

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );

    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id }, include: { holes: { orderBy: { number: "asc" } } } });
    createdGameIds.push(game.id);

    expect(game.holes).toHaveLength(18);
    // Cada hoyo tiene su propia distancia real — no hay dos hoyos con el mismo valor por duplicación.
    expect(new Set(game.holes.map((h) => h.distance)).size).toBe(18);
    expect(game.holes.map((h) => h.distance)).toEqual(EIGHTEEN_REAL_HOLES.map((h) => h.distance));
  });

  it("6. createRematch de una partida de 18 hoyos en un recorrido de 9 mantiene la misma segunda vuelta", async () => {
    const { course, layout, tee } = await makeCourseWithTee("Golf Pollença (test rematch)", "Pollença", 9, NINE_REAL_HOLES);
    createdCourseIds.push(course.id);

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );
    const original = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id } });
    createdGameIds.push(original.id);

    await runIgnoringRedirect(() => createRematch(original.id));

    const rematch = await prisma.game.findFirstOrThrow({
      where: { courseTeeId: tee.id, id: { not: original.id } },
      include: { holes: { orderBy: { number: "asc" } } },
    });
    createdGameIds.push(rematch.id);

    expect(rematch.holes).toHaveLength(18);
    expect(rematch.totalHoles).toBe(18);
    for (let i = 0; i < 9; i++) {
      expect(rematch.holes[i + 9].par).toBe(rematch.holes[i].par);
      expect(rematch.holes[i + 9].index).toBe(rematch.holes[i].index);
      expect(rematch.holes[i + 9].distance).toBe(rematch.holes[i].distance);
    }
  });

  it("7. GolfCourseTeeHole sigue teniendo únicamente los 9 hoyos reales del campo tras crear partidas a 18", async () => {
    const { course, layout, tee } = await makeCourseWithTee("Golf Pollença (test 7)", "Pollença", 9, NINE_REAL_HOLES);
    createdCourseIds.push(course.id);

    await runIgnoringRedirect(() =>
      createGame(undefined, createGameFormData({ courseId: course.id, courseLayoutId: layout.id, courseTeeId: tee.id, holeCount: 18 }))
    );
    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.id } });
    createdGameIds.push(game.id);

    const teeHoles = await prisma.golfCourseTeeHole.findMany({ where: { teeId: tee.id } });
    expect(teeHoles).toHaveLength(9);
    expect(teeHoles.map((h) => h.number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
