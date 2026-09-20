import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getGamePreviewByInviteCode } from "@/lib/data/games";

// Golf Alcanada, tee AMARILLAS (M) — mismo fixture real ya usado en
// games.handicap-snapshot.integration.test.ts (CR 72.4, Slope 135, Par
// 72), aquí como su propia copia para no acoplar los dos archivos de test.
const ALCANADA_HOLES = [
  { number: 1, par: 5, index: 11 },
  { number: 2, par: 4, index: 4 },
  { number: 3, par: 4, index: 12 },
  { number: 4, par: 3, index: 16 },
  { number: 5, par: 4, index: 7 },
  { number: 6, par: 3, index: 17 },
  { number: 7, par: 5, index: 3 },
  { number: 8, par: 4, index: 1 },
  { number: 9, par: 4, index: 5 },
  { number: 10, par: 4, index: 10 },
  { number: 11, par: 5, index: 6 },
  { number: 12, par: 4, index: 8 },
  { number: 13, par: 5, index: 18 },
  { number: 14, par: 3, index: 14 },
  { number: 15, par: 4, index: 13 },
  { number: 16, par: 4, index: 2 },
  { number: 17, par: 3, index: 9 },
  { number: 18, par: 4, index: 15 },
];

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", url });
  }),
}));

const { createGame, joinGame } = await import("@/actions/games");

async function runIgnoringRedirect(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as { digest?: string })?.digest !== "NEXT_REDIRECT") throw e;
  }
}

function createGameFormData(opts: { courseId: string; courseLayoutId: string; courseTeeId: string; playerCount?: number }) {
  const fd = new FormData();
  const playerCount = opts.playerCount ?? 1;
  fd.set("playerCount", String(playerCount));
  fd.set("mode", playerCount > 1 ? "DUEL" : "SOLO");
  fd.set("courseId", opts.courseId);
  fd.set("courseLayoutId", opts.courseLayoutId);
  fd.set("courseTeeId", opts.courseTeeId);
  fd.set("date", new Date().toISOString());
  fd.set("holeCount", "18");
  return fd;
}

describe("Invitar jugadores desde la app: enlace, vista pública y join (integración, DB real)", () => {
  const createdCourseIds: string[] = [];
  const createdGameIds: string[] = [];
  let creatorId = "";
  let inviteeId = "";

  beforeAll(async () => {
    const creator = await prisma.user.create({
      data: { email: `invite-creator-${Date.now()}@example.com`, name: "Antonio", handicap: 14 },
    });
    creatorId = creator.id;
    const invitee = await prisma.user.create({
      data: { email: `invite-invitee-${Date.now()}@example.com`, name: "Marta", handicap: 8 },
    });
    inviteeId = invitee.id;
  });

  afterAll(async () => {
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
    await prisma.golfCourse.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.delete({ where: { id: creatorId } });
    await prisma.user.delete({ where: { id: inviteeId } });
    await prisma.$disconnect();
  });

  async function makeAlcanadaTee(suffixLabel: string) {
    const suffix = `${Date.now()}-${suffixLabel}-${Math.random().toString(36).slice(2, 8)}`;
    const course = await prisma.golfCourse.create({
      data: { name: "Alcanada (test)", slug: `test-invite-alcanada-${suffix}`, island: "Test", country: "Test" },
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
        holes: { create: ALCANADA_HOLES },
      },
    });
    return { course, layout, tee };
  }

  async function createSoloGame(tee: { course: { id: string }; layout: { id: string }; tee: { id: string } }, playerCount = 2) {
    userId = creatorId;
    await runIgnoringRedirect(() =>
      createGame(
        undefined,
        createGameFormData({ courseId: tee.course.id, courseLayoutId: tee.layout.id, courseTeeId: tee.tee.id, playerCount })
      )
    );
    const game = await prisma.game.findFirstOrThrow({ where: { courseTeeId: tee.tee.id } });
    createdGameIds.push(game.id);
    return game;
  }

  it("2. enlace válido: la vista pública devuelve exactamente lo necesario para identificar la partida", async () => {
    const fixture = await makeAlcanadaTee("valid-link");
    const game = await createSoloGame(fixture, 2);

    const preview = await getGamePreviewByInviteCode(game.inviteCode);

    expect(preview).not.toBeNull();
    expect(preview!.id).toBe(game.id);
    expect(preview!.course).toBe("Alcanada (test)");
    expect(preview!.layoutName).toBe("Alcanada");
    expect(preview!.teeName).toBe("AMARILLAS");
    expect(preview!.totalHoles).toBe(18);
    expect(preview!.playerCount).toBe(2);
    expect(preview!.started).toBe(false);
    expect(preview!._count.players).toBe(1);
    expect(preview!.players[0]?.user.name).toBe("Antonio");
  });

  it("3. enlace inválido: un código que no existe devuelve null, no lanza excepción", async () => {
    const preview = await getGamePreviewByInviteCode("codigo-que-no-existe-nunca");
    expect(preview).toBeNull();
  });

  it("10. permisos: la vista pública no expone email, hándicap, ni el resto de jugadores de la partida", async () => {
    const fixture = await makeAlcanadaTee("permissions");
    const game = await createSoloGame(fixture, 2);

    // Un segundo jugador ya está dentro (no por invitación, directo por prisma, para aislar este test del flujo de join).
    await prisma.gamePlayer.create({ data: { gameId: game.id, userId: inviteeId } });

    const preview = await getGamePreviewByInviteCode(game.inviteCode);

    // Solo se ve al primero (el creador/host) — nunca la lista completa de jugadores.
    expect(preview!.players).toHaveLength(1);
    expect(preview!.players[0]?.user.name).toBe("Antonio");
    // El objeto devuelto no tiene ningún campo de email/hándicap: al no
    // seleccionarlos en el `select` de Prisma, ni siquiera existen en el
    // resultado (verificado en runtime, no solo por tipos).
    expect(Object.keys(preview!.players[0]!.user)).toEqual(["name"]);
    expect(Object.keys(preview!)).not.toContain("handicapIndex");
    expect(Object.keys(preview!)).not.toContain("courseTeeId");
  });

  it("4/7/8. join autenticado crea GamePlayer con la foto de hándicap del invitado (Course/Playing Handicap calculados sobre el tee ya congelado)", async () => {
    const fixture = await makeAlcanadaTee("join-snapshot");
    const game = await createSoloGame(fixture, 2);

    userId = inviteeId;
    await runIgnoringRedirect(() => joinGame(game.inviteCode));

    const joined = await prisma.gamePlayer.findUniqueOrThrow({ where: { gameId_userId: { gameId: game.id, userId: inviteeId } } });
    expect(joined.handicapIndex).toBe(8);
    // round(8 * 135/113 + (72.4-72)) = round(9.5575 + 0.4) = round(9.9575) = 10
    expect(joined.courseHandicap).toBe(10);
    expect(joined.playingHandicap).toBe(10);
    expect(joined.handicapAllowance).toBe(1);

    const preview = await getGamePreviewByInviteCode(game.inviteCode);
    expect(preview!._count.players).toBe(2);
  });

  it("9. usuario ya unido: llamar a joinGame dos veces no crea una segunda fila (unique gameId+userId)", async () => {
    const fixture = await makeAlcanadaTee("already-joined");
    const game = await createSoloGame(fixture, 2);

    userId = inviteeId;
    await runIgnoringRedirect(() => joinGame(game.inviteCode));
    await runIgnoringRedirect(() => joinGame(game.inviteCode));

    const rows = await prisma.gamePlayer.findMany({ where: { gameId: game.id, userId: inviteeId } });
    expect(rows).toHaveLength(1);
  });

  it("partida completa: joinGame rechaza unirse cuando ya no hay hueco", async () => {
    const fixture = await makeAlcanadaTee("full-game");
    // playerCount 1: el creador ya llena la única plaza.
    const game = await createSoloGame(fixture, 1);

    const preview = await getGamePreviewByInviteCode(game.inviteCode);
    expect(preview!._count.players).toBe(preview!.playerCount); // ya está completa

    userId = inviteeId;
    await expect(joinGame(game.inviteCode)).rejects.toThrow("Esta partida ya está completa");

    const rows = await prisma.gamePlayer.findMany({ where: { gameId: game.id, userId: inviteeId } });
    expect(rows).toHaveLength(0);
  });

  it("10. permisos: sin sesión, joinGame nunca crea un GamePlayer — solo redirige", async () => {
    const fixture = await makeAlcanadaTee("no-session");
    const game = await createSoloGame(fixture, 2);

    userId = ""; // sin sesión (el mock de auth() devuelve null)
    await runIgnoringRedirect(() => joinGame(game.inviteCode));

    const rows = await prisma.gamePlayer.findMany({ where: { gameId: game.id } });
    expect(rows).toHaveLength(1); // solo el creador, nadie se ha colado sin sesión
  });
});
