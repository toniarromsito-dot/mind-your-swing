import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { strokesReceivedOnHole } from "@/lib/games/handicap";
import { getCoachContext } from "./context";

/**
 * Fase 10 — Coach contextualizado con rondas y estadísticas. Pruebas de
 * integración contra la BD real: `getCoachContext` compone Prisma
 * (usuario/partida/hoyo) con `getPlayerStats` (Fase 9), así que hace falta
 * la base de datos real para probarlo de verdad, igual que
 * `player-stats.integration.test.ts`.
 */
describe("getCoachContext — estadísticas históricas, handicap y hoyo actual (integración, DB real)", () => {
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

  async function makeUser(name: string, handicap: number | null = null) {
    const user = await prisma.user.create({
      data: { email: `coach-context-${Date.now()}-${Math.random()}@example.com`, name, handicap },
    });
    userIds.push(user.id);
    return user;
  }

  /** Crea una partida COMPLETED con N hoyos par 4 y golpes fijos para un único jugador — mismo patrón que player-stats.integration.test.ts. */
  async function makeCompletedGame(
    userId: string,
    opts: { holeCount?: number; strokesPerHole?: number; date?: Date } = {}
  ) {
    const holeCount = opts.holeCount ?? 9;
    const strokesPerHole = opts.strokesPerHole ?? 4;
    const game = await prisma.game.create({
      data: {
        course: "Campo de pruebas",
        mode: "SOLO",
        date: opts.date ?? new Date(),
        totalHoles: holeCount,
        status: "COMPLETED",
        inviteCode: `coach-ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    gameIds.push(game.id);

    const holes = await Promise.all(
      Array.from({ length: holeCount }, (_, i) => prisma.hole.create({ data: { gameId: game.id, number: i + 1, par: 4, index: i + 1 } }))
    );

    const player = await prisma.gamePlayer.create({ data: { gameId: game.id, userId } });
    for (const hole of holes) {
      await prisma.score.create({ data: { holeId: hole.id, playerId: player.id, strokes: strokesPerHole } });
    }
    return game;
  }

  /** Crea una partida IN_PROGRESS con un hoyo actual concreto (Stroke Index + Playing Handicap), para el contexto "durante_partida". */
  async function makeInProgressGame(userId: string, opts: { holeIndex: number; playingHandicap: number | null }) {
    const game = await prisma.game.create({
      data: {
        course: "Campo En Curso",
        mode: "SOLO",
        date: new Date(),
        totalHoles: 3,
        status: "IN_PROGRESS",
        inviteCode: `coach-ctx-inprogress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    gameIds.push(game.id);

    const hole1 = await prisma.hole.create({ data: { gameId: game.id, number: 1, par: 4, index: opts.holeIndex } });
    await prisma.hole.create({ data: { gameId: game.id, number: 2, par: 3, index: opts.holeIndex === 1 ? 2 : 1 } });

    const player = await prisma.gamePlayer.create({ data: { gameId: game.id, userId, playingHandicap: opts.playingHandicap } });
    await prisma.score.create({ data: { holeId: hole1.id, playerId: player.id, strokes: 3, putts: 1 } });

    return { game, hole1, player };
  }

  it("1. usuario sin rondas: playerStats vacío, sin inventar cifras", async () => {
    const user = await makeUser("Sin Rondas");
    const ctx = await getCoachContext({ userId: user.id });

    expect(ctx.phase).toBe("standalone");
    expect(ctx.playerStats.completedRounds).toBe(0);
    expect(ctx.playerStats.averageRelativeToPar).toBeNull();
    expect(ctx.playerStats.trend).toBeNull();
    expect(ctx.playerStats.consistency).toBeNull();
    expect(ctx.playerStats.byCourse).toEqual([]);
  });

  it("2. usuario con pocas rondas (por debajo de los mínimos de muestra): trend/consistency siguen null", async () => {
    const user = await makeUser("Pocas Rondas");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4 });
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 5 });

    const ctx = await getCoachContext({ userId: user.id });
    expect(ctx.playerStats.completedRounds).toBe(2);
    expect(ctx.playerStats.trend).toBeNull(); // mínimo 4 vueltas
    expect(ctx.playerStats.consistency).toBeNull(); // mínimo 3 vueltas
    expect(ctx.playerStats.averageRelativeToPar).not.toBeNull(); // esto sí tiene muestra (1+)
  });

  it("3. usuario con suficientes rondas: trend/consistency dejan de ser null", async () => {
    const user = await makeUser("Rondas Suficientes");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4, date: new Date("2026-01-01") });
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4, date: new Date("2026-02-01") });
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 6, date: new Date("2026-03-01") });
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 8, date: new Date("2026-04-01") });

    const ctx = await getCoachContext({ userId: user.id });
    expect(ctx.playerStats.completedRounds).toBe(4);
    expect(ctx.playerStats.consistency).not.toBeNull();
    expect(ctx.playerStats.consistency?.sampleSize).toBe(4);
    expect(ctx.playerStats.trend).not.toBeNull();
  });

  it("4. métricas null se propagan tal cual, sin fabricar un valor sustituto", async () => {
    const user = await makeUser("Un Solo Campo");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 5 });

    const ctx = await getCoachContext({ userId: user.id });
    // 1 sola vuelta => byCourse tiene el campo, pero su promedio SÍ es fiable con 1 vuelta
    // (la regla de "muestra insuficiente" es de player-stats.ts, no se toca aquí) —
    // lo que debe seguir null con una sola vuelta es trend/consistency.
    expect(ctx.playerStats.trend).toBeNull();
    expect(ctx.playerStats.consistency).toBeNull();
    expect(ctx.playerStats.bestRound).not.toBeNull();
  });

  it("5. Coach sin gameId (standalone): game/currentHole/gameProgress son null, playerStats siempre presente", async () => {
    const user = await makeUser("Standalone");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4 });

    const ctx = await getCoachContext({ userId: user.id });
    expect(ctx.phase).toBe("standalone");
    expect(ctx.game).toBeNull();
    expect(ctx.currentHole).toBeNull();
    expect(ctx.gameProgress).toBeNull();
    expect(ctx.playerStats.completedRounds).toBe(1);
  });

  it("6. Coach durante una partida: currentHole y game se rellenan junto con playerStats histórico", async () => {
    const user = await makeUser("Durante Partida", 20);
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4 }); // historial previo real
    const { game, hole1 } = await makeInProgressGame(user.id, { holeIndex: 5, playingHandicap: 12 });

    const ctx = await getCoachContext({ userId: user.id, gameId: game.id, holeId: hole1.id });
    expect(ctx.phase).toBe("durante_partida");
    expect(ctx.game).not.toBeNull();
    expect(ctx.currentHole).not.toBeNull();
    expect(ctx.currentHole?.strokes).toBe(3);
    expect(ctx.currentHole?.putts).toBe(1);
    expect(ctx.playerStats.completedRounds).toBe(1); // el histórico sigue disponible como contexto secundario
  });

  it("7. stroke index del hoyo actual refleja Hole.index real", async () => {
    const user = await makeUser("Stroke Index");
    const { game, hole1 } = await makeInProgressGame(user.id, { holeIndex: 7, playingHandicap: 10 });

    const ctx = await getCoachContext({ userId: user.id, gameId: game.id, holeId: hole1.id });
    expect(ctx.currentHole?.index).toBe(7);
  });

  it("8. Playing Handicap de la partida refleja GamePlayer.playingHandicap real", async () => {
    const user = await makeUser("Playing HCP");
    const { game, hole1 } = await makeInProgressGame(user.id, { holeIndex: 1, playingHandicap: 16 });

    const ctx = await getCoachContext({ userId: user.id, gameId: game.id, holeId: hole1.id });
    expect(ctx.game?.playingHandicap).toBe(16);
  });

  it("8b. sin Playing Handicap guardado en GamePlayer, el campo queda null (no se inventa)", async () => {
    const user = await makeUser("Sin Playing HCP");
    const { game, hole1 } = await makeInProgressGame(user.id, { holeIndex: 1, playingHandicap: null });

    const ctx = await getCoachContext({ userId: user.id, gameId: game.id, holeId: hole1.id });
    expect(ctx.game?.playingHandicap).toBeNull();
    expect(ctx.currentHole?.strokesReceived).toBeNull(); // sin playingHandicap no se puede calcular
  });

  it("9. strokesReceived usa exclusivamente strokesReceivedOnHole(playingHandicap, index) — mismo resultado que llamarla directamente", async () => {
    const user = await makeUser("Golpes De Hándicap");
    const { game, hole1 } = await makeInProgressGame(user.id, { holeIndex: 5, playingHandicap: 23 });

    const ctx = await getCoachContext({ userId: user.id, gameId: game.id, holeId: hole1.id });
    expect(ctx.currentHole?.strokesReceived).toBe(strokesReceivedOnHole(23, 5));
    expect(ctx.currentHole?.strokesReceived).toBe(2); // 23 -> 1 vuelta completa (18) + resto 5 >= index 5 -> +1 = 2
  });

  it("10. el contexto de partida y el histórico coexisten (la priorización de orden es responsabilidad de prompt.ts, ya probada ahí)", async () => {
    const user = await makeUser("Coexisten");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 5 });
    const { game, hole1 } = await makeInProgressGame(user.id, { holeIndex: 1, playingHandicap: 10 });

    const ctx = await getCoachContext({ userId: user.id, gameId: game.id, holeId: hole1.id });
    expect(ctx.game).not.toBeNull();
    expect(ctx.currentHole).not.toBeNull();
    expect(ctx.playerStats.completedRounds).toBeGreaterThan(0);
  });

  it("11. playerStats nunca incluye métricas inexistentes en la app (fairways, GIR, distancia de golpes, strokes gained)", async () => {
    const user = await makeUser("Sin Metricas Inventadas");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4 });

    const ctx = await getCoachContext({ userId: user.id });
    const serialized = JSON.stringify(ctx.playerStats).toLowerCase();
    expect(serialized).not.toContain("fairway");
    expect(serialized).not.toContain("gir");
    expect(serialized).not.toContain("stableford");
    expect(serialized).not.toContain("strokesgained");
    expect(serialized).not.toContain("whs");
  });

  it("12. OWNERSHIP: el contexto de un usuario nunca incluye estadísticas ni handicap de otro usuario", async () => {
    const userA = await makeUser("Usuario A", 15);
    const userB = await makeUser("Usuario B", 30);
    await makeCompletedGame(userA.id, { holeCount: 9, strokesPerHole: 4 });
    await makeCompletedGame(userB.id, { holeCount: 9, strokesPerHole: 10 }); // muy distinto, imposible de confundir

    const ctxA = await getCoachContext({ userId: userA.id });
    const ctxB = await getCoachContext({ userId: userB.id });

    expect(ctxA.playerHandicap).toBe(15);
    expect(ctxB.playerHandicap).toBe(30);
    expect(ctxA.playerStats.completedRounds).toBe(1);
    expect(ctxA.playerStats.averageRelativeToPar).toBe(0); // par exacto, nunca el +54 de userB
    expect(ctxB.playerStats.averageRelativeToPar).toBe(54);
  });

  it("12b. OWNERSHIP: en una partida compartida, currentHole solo refleja los golpes propios, nunca los del otro jugador", async () => {
    const userA = await makeUser("Comparte A");
    const userB = await makeUser("Comparte B");

    const game = await prisma.game.create({
      data: {
        course: "Campo Compartido",
        mode: "TWO_VS_TWO",
        date: new Date(),
        totalHoles: 1,
        status: "IN_PROGRESS",
        inviteCode: `coach-ctx-shared-${Date.now()}`,
      },
    });
    gameIds.push(game.id);
    const hole = await prisma.hole.create({ data: { gameId: game.id, number: 1, par: 4, index: 1 } });
    const playerA = await prisma.gamePlayer.create({ data: { gameId: game.id, userId: userA.id } });
    const playerB = await prisma.gamePlayer.create({ data: { gameId: game.id, userId: userB.id } });
    await prisma.score.create({ data: { holeId: hole.id, playerId: playerA.id, strokes: 4 } });
    await prisma.score.create({ data: { holeId: hole.id, playerId: playerB.id, strokes: 9 } });

    const ctxA = await getCoachContext({ userId: userA.id, gameId: game.id, holeId: hole.id });
    expect(ctxA.currentHole?.strokes).toBe(4); // nunca el 9 de userB
  });

  it("privacidad: el bloque playerStats no expone email ni IDs internos", async () => {
    const user = await makeUser("Privacidad");
    await makeCompletedGame(user.id, { holeCount: 9, strokesPerHole: 4 });

    const ctx = await getCoachContext({ userId: user.id });
    const serialized = JSON.stringify(ctx.playerStats);
    expect(serialized).not.toContain("@example.com");
    expect(serialized).not.toContain(user.id);
    for (const gid of gameIds) {
      expect(serialized).not.toContain(gid);
    }
  });

  /**
   * Fase 11C — entitlements. Coach básico (contexto estructurado, sin
   * mindMemory) sigue disponible para FREE — nunca se elimina el acceso a
   * Coach. Solo la memoria evolutiva (Pro) se filtra en el propio
   * getCoachContext, antes de que el objeto salga hacia el prompt/cliente
   * — nunca "se manda y el front la oculta".
   */
  async function makeUserWithPlan(name: string, plan: "FREE" | "PRO", mindMemory: string | null = null) {
    const user = await prisma.user.create({
      data: {
        email: `coach-context-plan-${Date.now()}-${Math.random()}@example.com`,
        name,
        plan,
        mindMemory,
      },
    });
    userIds.push(user.id);
    return user;
  }

  it("3. FREE → Coach básico OK: sigue recibiendo datos estructurados reales (playerStats)", async () => {
    const free = await makeUserWithPlan("Free Coach Basico", "FREE");
    await makeCompletedGame(free.id, { holeCount: 9, strokesPerHole: 4 });

    const ctx = await getCoachContext({ userId: free.id });
    expect(ctx.playerStats.completedRounds).toBe(1);
  });

  it("4. FREE → Coach Memory DENIED: mindMemory nunca sale del backend aunque exista en BD", async () => {
    const free = await makeUserWithPlan(
      "Free Sin Memoria",
      "FREE",
      "Memoria real guardada en BD que un FREE no debería poder leer"
    );

    const ctx = await getCoachContext({ userId: free.id });
    expect(ctx.mindMemory).toBeNull();
    expect(JSON.stringify(ctx)).not.toContain("Memoria real guardada");
  });

  it("5. PRO → Coach Memory OK: mindMemory se incluye tal cual", async () => {
    const pro = await makeUserWithPlan("Pro Con Memoria", "PRO", "Trabajamos la reacción tras un doble bogey.");

    const ctx = await getCoachContext({ userId: pro.id });
    expect(ctx.mindMemory).toBe("Trabajamos la reacción tras un doble bogey.");
  });

  it("31/33. OWNERSHIP + entitlement combinados: el contexto de un FREE nunca incluye ni su propia memoria (denegada) ni la de un PRO distinto", async () => {
    const free = await makeUserWithPlan("Free Combinado", "FREE", "Memoria de FREE, no debería salir nunca");
    const pro = await makeUserWithPlan("Pro Combinado", "PRO", "Memoria real de PRO, dato premium de otro usuario");

    const ctxFree = await getCoachContext({ userId: free.id });
    const ctxPro = await getCoachContext({ userId: pro.id });

    expect(ctxFree.mindMemory).toBeNull();
    expect(ctxPro.mindMemory).toBe("Memoria real de PRO, dato premium de otro usuario");
    // El contexto de FREE, pedido con SU propio userId, jamás contiene el dato premium de otro usuario.
    expect(JSON.stringify(ctxFree)).not.toContain("dato premium de otro usuario");
  });
});
