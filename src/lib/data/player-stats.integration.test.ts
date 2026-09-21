import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPlayerRoundsForStats, getPlayerStats } from "./player-stats";

describe("getPlayerRoundsForStats / getPlayerStats — Fase 9, capa de estadísticas (integración, DB real)", () => {
  const userIds: string[] = [];
  const gameIds: string[] = [];

  afterAll(async () => {
    await prisma.score.deleteMany({ where: { hole: { gameId: { in: gameIds } } } });
    await prisma.gamePlayer.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.hole.deleteMany({ where: { gameId: { in: gameIds } } });
    await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(name: string) {
    const user = await prisma.user.create({ data: { email: `player-stats-${Date.now()}-${Math.random()}@example.com`, name } });
    userIds.push(user.id);
    return user;
  }

  /** Crea una partida COMPLETED (o no) con N hoyos par 4 y golpes fijos para un único jugador. */
  async function makeCompletedGame(
    userId: string,
    opts: { holeCount?: number; strokesPerHole?: number; status?: "COMPLETED" | "IN_PROGRESS"; date?: Date; extraPlayerId?: string } = {}
  ) {
    const holeCount = opts.holeCount ?? 9;
    const strokesPerHole = opts.strokesPerHole ?? 4;
    const game = await prisma.game.create({
      data: {
        course: "Campo de pruebas",
        mode: "SOLO",
        date: opts.date ?? new Date(),
        totalHoles: holeCount,
        status: opts.status ?? "COMPLETED",
        inviteCode: `stats-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    gameIds.push(game.id);

    const holes = await Promise.all(
      Array.from({ length: holeCount }, (_, i) =>
        prisma.hole.create({ data: { gameId: game.id, number: i + 1, par: 4, index: i + 1 } })
      )
    );

    const player = await prisma.gamePlayer.create({ data: { gameId: game.id, userId } });
    for (const hole of holes) {
      await prisma.score.create({ data: { holeId: hole.id, playerId: player.id, strokes: strokesPerHole } });
    }

    if (opts.extraPlayerId) {
      const otherPlayer = await prisma.gamePlayer.create({ data: { gameId: game.id, userId: opts.extraPlayerId } });
      for (const hole of holes) {
        // El otro jugador anota MUY distinto (par -3, imposible de confundir con los golpes de userId).
        await prisma.score.create({ data: { holeId: hole.id, playerId: otherPlayer.id, strokes: 1 } });
      }
    }

    return game;
  }

  it("un jugador nuevo sin partidas obtiene estadísticas vacías, no un error", async () => {
    const user = await makeUser("Jugador Nuevo");
    const stats = await getPlayerStats(user.id);
    expect(stats.completedRounds).toBe(0);
    expect(stats.averageRelativeToPar).toBeNull();
    expect(stats.trend).toBeNull();
    expect(stats.byCourse).toEqual([]);
  });

  it("un jugador con 1 partida obtiene sus estadísticas reales de esa partida", async () => {
    const user = await makeUser("Un Partido");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 5 }); // +1 por hoyo -> +9 total

    const stats = await getPlayerStats(user.id);
    expect(stats.completedRounds).toBe(1);
    expect(stats.holesPlayed).toBe(9);
    expect(stats.totalStrokes).toBe(45);
    expect(stats.averageRelativeToPar).toBe(9);
    expect(stats.bestRound?.relativeToPar).toBe(9);
  });

  it("un jugador con varias partidas ve el conteo y la media agregada correctamente", async () => {
    const user = await makeUser("Varias Partidas");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4 }); // 0
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 5 }); // +9
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 6 }); // +18

    const stats = await getPlayerStats(user.id);
    expect(stats.completedRounds).toBe(3);
    expect(stats.averageRelativeToPar).toBe((0 + 9 + 18) / 3);
  });

  it("ignora partidas IN_PROGRESS — solo cuentan las COMPLETED", async () => {
    const user = await makeUser("Con Partida Abierta");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4 });
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4, status: "IN_PROGRESS" });

    const stats = await getPlayerStats(user.id);
    expect(stats.completedRounds).toBe(1);
  });

  it("OWNERSHIP: las estadísticas de un jugador nunca incluyen los golpes de otro jugador de la MISMA partida", async () => {
    const userA = await makeUser("Jugador A");
    const userB = await makeUser("Jugador B");
    // Partida compartida: A anota 4 golpes/hoyo, B anota 1 golpe/hoyo (imposible confundir).
    await makeCompletedGame(userA.id, { holeCount: 9, strokesPerHole: 4, extraPlayerId: userB.id });

    const statsA = await getPlayerRoundsForStats(userA.id);
    expect(statsA).toHaveLength(1);
    expect(statsA[0].holes.every((h) => h.strokes === 4)).toBe(true); // nunca el 1 de userB

    const statsB = await getPlayerRoundsForStats(userB.id);
    expect(statsB).toHaveLength(1);
    expect(statsB[0].holes.every((h) => h.strokes === 1)).toBe(true); // nunca el 4 de userA
  });

  it("OWNERSHIP: un jugador sin partidas propias no ve las partidas de otro jugador", async () => {
    const userA = await makeUser("Tiene Partidas");
    const userB = await makeUser("Sin Partidas Propias");
    await makeCompletedGame(userA.id, { holeCount: 9, strokesPerHole: 4 });

    const statsB = await getPlayerStats(userB.id);
    expect(statsB.completedRounds).toBe(0);
  });
});
