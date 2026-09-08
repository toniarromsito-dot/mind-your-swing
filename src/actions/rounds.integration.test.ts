import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

let userId: string;

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: userId } })),
  signOut: vi.fn(),
}));

const { createRound, finishRound } = await import("@/actions/rounds");
const { updateHole } = await import("@/actions/holes");
const { createMoodEntry } = await import("@/actions/mood");

describe("acciones de ronda (integración, DB real)", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `rounds-test-${Date.now()}@example.com`, name: "Test Player" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("createRound crea la ronda, sus hoyos y el check-in inicial", async () => {
    const fd = new FormData();
    fd.set("course", "Campo de Integración");
    fd.set("date", "2026-05-01");
    fd.set("totalHoles", "9");
    fd.set("goal", "Probar el flujo");
    fd.set("initialMood", "TRANQUILO");
    fd.set("initialNote", "");

    await createRound(undefined, fd);

    const round = await prisma.round.findFirstOrThrow({
      where: { userId, course: "Campo de Integración" },
      include: { holes: true, moodEntries: true },
    });

    expect(round.holes).toHaveLength(9);
    expect(round.holes[0].par).toBe(4);
    expect(round.moodEntries).toHaveLength(1);
    expect(round.moodEntries[0].mood).toBe("TRANQUILO");
  });

  it("rechaza un nombre de campo inválido sin tocar la base de datos", async () => {
    const fd = new FormData();
    fd.set("course", "A");
    fd.set("date", "2026-05-01");
    fd.set("totalHoles", "18");

    const result = await createRound(undefined, fd);
    expect(result?.error).toBeTruthy();
  });

  it("updateHole guarda golpes y par de un hoyo propio", async () => {
    const round = await prisma.round.findFirstOrThrow({
      where: { userId, course: "Campo de Integración" },
      include: { holes: { orderBy: { number: "asc" } } },
    });
    const hole = round.holes[0];

    await updateHole(round.id, { holeId: hole.id, strokes: 5, par: 4 });

    const updated = await prisma.hole.findUniqueOrThrow({ where: { id: hole.id } });
    expect(updated.strokes).toBe(5);
    expect(updated.par).toBe(4);
  });

  it("updateHole rechaza un hoyo que no pertenece al usuario autenticado", async () => {
    const otherUser = await prisma.user.create({
      data: { email: `other-${Date.now()}@example.com` },
    });
    const otherRound = await prisma.round.create({
      data: {
        userId: otherUser.id,
        course: "Campo Ajeno",
        date: new Date(),
        holes: { create: [{ number: 1, par: 4 }] },
      },
      include: { holes: true },
    });

    await expect(
      updateHole(otherRound.id, { holeId: otherRound.holes[0].id, strokes: 3 })
    ).rejects.toThrow();

    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it("createMoodEntry liga el check-in a la ronda y (opcionalmente) al hoyo", async () => {
    const round = await prisma.round.findFirstOrThrow({
      where: { userId, course: "Campo de Integración" },
      include: { holes: true },
    });

    await createMoodEntry({
      roundId: round.id,
      holeId: round.holes[0].id,
      mood: "CONFIADO",
      note: "Buen golpe",
    });

    const entries = await prisma.moodEntry.findMany({
      where: { roundId: round.id, mood: "CONFIADO" },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].holeId).toBe(round.holes[0].id);
  });

  it("finishRound marca la ronda como completada", async () => {
    const round = await prisma.round.findFirstOrThrow({
      where: { userId, course: "Campo de Integración" },
    });

    await finishRound(round.id);

    const updated = await prisma.round.findUniqueOrThrow({ where: { id: round.id } });
    expect(updated.status).toBe("COMPLETED");
  });
});
