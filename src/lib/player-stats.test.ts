import { describe, expect, it } from "vitest";
import {
  aggregateScoreBreakdown,
  computeBaseStats,
  computeConsistency,
  computeCourseBreakdown,
  computeFormatBreakdown,
  computeHandicapEvolution,
  computeHoleParBreakdown,
  computePlayerStats,
  computeScoringTrend,
  type PlayerRound,
  type PlayerStatsHole,
} from "./player-stats";

function hole(par: number, strokes: number | null, overrides: Partial<PlayerStatsHole> = {}): PlayerStatsHole {
  return { number: overrides.number ?? 1, par, index: overrides.index ?? null, strokes, putts: overrides.putts ?? null };
}

function round(overrides: Partial<PlayerRound> & { holes: PlayerStatsHole[] }): PlayerRound {
  return {
    gameId: overrides.gameId ?? `game-${Math.random()}`,
    course: overrides.course ?? "Campo de pruebas",
    date: overrides.date ?? new Date("2026-01-01"),
    totalHoles: overrides.totalHoles ?? overrides.holes.length,
    handicapIndex: overrides.handicapIndex ?? null,
    holes: overrides.holes,
  };
}

// Vuelta plana: N hoyos par 4, con un resultado fijo relativo al par.
function flatRound(n: number, relativePerHole: number, overrides: Partial<PlayerRound> = {}): PlayerRound {
  const holes = Array.from({ length: n }, (_, i) => hole(4, 4 + relativePerHole, { number: i + 1, index: (i % 18) + 1 }));
  return round({ ...overrides, holes });
}

describe("computeBaseStats", () => {
  it("con 0 vueltas, todo en 0/null", () => {
    const stats = computeBaseStats([]);
    expect(stats).toMatchObject({
      completedRounds: 0,
      holesPlayed: 0,
      totalStrokes: 0,
      averageStrokesPerHole: null,
      averageRelativeToPar: null,
      bestRound: null,
      worstRound: null,
      recentRound: null,
      roundsThisMonth: 0,
    });
  });

  it("con 1 vuelta, la media/mejor/peor son esa misma vuelta", () => {
    const r = flatRound(18, 0); // par
    const stats = computeBaseStats([r]);
    expect(stats.completedRounds).toBe(1);
    expect(stats.holesPlayed).toBe(18);
    expect(stats.totalStrokes).toBe(18 * 4);
    expect(stats.averageStrokesPerHole).toBe(4);
    expect(stats.averageRelativeToPar).toBe(0);
    expect(stats.bestRound?.gameId).toBe(r.gameId);
    expect(stats.worstRound?.gameId).toBe(r.gameId);
    expect(stats.recentRound?.gameId).toBe(r.gameId);
  });

  it("una vuelta sin ningún hoyo jugado no cuenta como 'a la par' — se excluye de la media/mejor/peor", () => {
    const empty = round({ holes: [hole(4, null), hole(4, null)] });
    const played = flatRound(9, 2);
    const stats = computeBaseStats([played, empty]);
    expect(stats.averageRelativeToPar).toBe(18); // 9 hoyos * (+2) = +18, solo de `played`
    expect(stats.bestRound?.gameId).toBe(played.gameId);
    expect(stats.worstRound?.gameId).toBe(played.gameId);
  });

  it("elige correctamente mejor y peor vuelta entre varias", () => {
    const best = flatRound(18, -1, { gameId: "best" });
    const mid = flatRound(18, 0, { gameId: "mid" });
    const worst = flatRound(18, 3, { gameId: "worst" });
    const stats = computeBaseStats([mid, best, worst]);
    expect(stats.bestRound?.gameId).toBe("best");
    expect(stats.worstRound?.gameId).toBe("worst");
  });

  it("roundsThisMonth cuenta solo las vueltas del mes natural en curso", () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const r1 = flatRound(9, 0, { date: thisMonth });
    const r2 = flatRound(9, 0, { date: lastMonth });
    const stats = computeBaseStats([r1, r2]);
    expect(stats.roundsThisMonth).toBe(1);
  });
});

describe("computeConsistency", () => {
  it("con menos de 3 vueltas con hoyos jugados, null", () => {
    expect(computeConsistency([flatRound(9, 0), flatRound(9, 1)])).toBeNull();
  });

  it("con 3+ vueltas, calcula la desviación estándar del relativo al par", () => {
    const rounds = [flatRound(18, -2), flatRound(18, 0), flatRound(18, 2)];
    const consistency = computeConsistency(rounds);
    expect(consistency).not.toBeNull();
    expect(consistency!.sampleSize).toBe(3);
    expect(consistency!.stdDev).toBeCloseTo(Math.sqrt(((-36) ** 2 + 0 ** 2 + 36 ** 2) / 3 - 0), 5);
  });
});

describe("computeScoringTrend", () => {
  it("con menos de 4 vueltas, null", () => {
    expect(computeScoringTrend([flatRound(9, 0), flatRound(9, 0), flatRound(9, 0)])).toBeNull();
  });

  it("mejora clara (relativo al par baja) en la mitad reciente -> 'up'", () => {
    // rounds[] viene más reciente primero; construimos 4 vueltas donde las
    // 2 MÁS RECIENTES (índices 0-1) son mejores que las 2 más antiguas (2-3).
    const rounds = [
      flatRound(18, -3, { date: new Date("2026-04-01") }),
      flatRound(18, -3, { date: new Date("2026-03-01") }),
      flatRound(18, 3, { date: new Date("2026-02-01") }),
      flatRound(18, 3, { date: new Date("2026-01-01") }),
    ];
    const trend = computeScoringTrend(rounds);
    expect(trend).toEqual({ trend: "up", diff: -108 });
  });

  it("empeora en la mitad reciente -> 'down'", () => {
    const rounds = [
      flatRound(18, 3, { date: new Date("2026-04-01") }),
      flatRound(18, 3, { date: new Date("2026-03-01") }),
      flatRound(18, -3, { date: new Date("2026-02-01") }),
      flatRound(18, -3, { date: new Date("2026-01-01") }),
    ];
    const trend = computeScoringTrend(rounds);
    expect(trend).toEqual({ trend: "down", diff: 108 });
  });

  it("diferencia por debajo del umbral -> null (ruido, no tendencia)", () => {
    const rounds = [
      flatRound(18, 0, { date: new Date("2026-04-01") }),
      flatRound(18, 0, { date: new Date("2026-03-01") }),
      flatRound(18, 0, { date: new Date("2026-02-01") }),
      flatRound(18, 0, { date: new Date("2026-01-01") }),
    ];
    expect(computeScoringTrend(rounds)).toBeNull();
  });
});

describe("aggregateScoreBreakdown", () => {
  it("clasifica cada hoyo en el bucket correcto, e ignora hoyos sin jugar", () => {
    const r = round({
      holes: [
        hole(4, 2), // eagle -> other
        hole(4, 3), // birdie
        hole(4, 4), // par
        hole(4, 5), // bogey
        hole(4, 6), // double bogey
        hole(4, 7), // triple -> other
        hole(4, null), // sin jugar, se ignora
      ],
    });
    expect(aggregateScoreBreakdown([r])).toEqual({ pars: 1, birdies: 1, bogeys: 1, doubleBogeys: 1, other: 2 });
  });

  it("con 0 hoyos jugados, todo en 0 (nunca null — es un recuento, no una media)", () => {
    const r = round({ holes: [hole(4, null)] });
    expect(aggregateScoreBreakdown([r])).toEqual({ pars: 0, birdies: 0, bogeys: 0, doubleBogeys: 0, other: 0 });
  });
});

describe("computeCourseBreakdown", () => {
  it("agrupa por campo, con roundsCount siempre presente y media cuando hay hoyos jugados", () => {
    const a1 = flatRound(18, 0, { course: "Campo A" });
    const a2 = flatRound(18, 4, { course: "Campo A" });
    const b1 = round({ course: "Campo B", holes: [hole(4, null)] }); // sin hoyos jugados
    const result = computeCourseBreakdown([a1, a2, b1]);

    const campoA = result.find((c) => c.course === "Campo A")!;
    expect(campoA.roundsCount).toBe(2);
    expect(campoA.averageRelativeToPar).toBe(36); // (0 + 72) / 2 = 36

    const campoB = result.find((c) => c.course === "Campo B")!;
    expect(campoB.roundsCount).toBe(1);
    expect(campoB.averageRelativeToPar).toBeNull();
  });
});

describe("computeHoleParBreakdown", () => {
  it("agrupa por par del hoyo; media null por debajo del mínimo de 3 hoyos", () => {
    const r = round({
      holes: [
        hole(3, 3), // par3, par
        hole(3, 4), // par3, bogey
        hole(4, 4),
        hole(4, 5),
        hole(4, 6),
      ],
    });
    const result = computeHoleParBreakdown([r]);
    const par3 = result.find((h) => h.par === 3)!;
    expect(par3.holesPlayed).toBe(2);
    expect(par3.averageRelativeToPar).toBeNull(); // < 3 hoyos

    const par4 = result.find((h) => h.par === 4)!;
    expect(par4.holesPlayed).toBe(3);
    expect(par4.averageRelativeToPar).toBeCloseTo((0 + 1 + 2) / 3);
  });
});

describe("computeFormatBreakdown", () => {
  it("agrupa por totalHoles; media null con menos de 2 vueltas en ese formato", () => {
    const nine1 = flatRound(9, 0, { totalHoles: 9 });
    const eighteen1 = flatRound(18, 0, { totalHoles: 18 });
    const eighteen2 = flatRound(18, 2, { totalHoles: 18 });
    const result = computeFormatBreakdown([nine1, eighteen1, eighteen2]);

    const nine = result.find((f) => f.totalHoles === 9)!;
    expect(nine.roundsCount).toBe(1);
    expect(nine.averageRelativeToPar).toBeNull();

    const eighteen = result.find((f) => f.totalHoles === 18)!;
    expect(eighteen.roundsCount).toBe(2);
    expect(eighteen.averageRelativeToPar).toBe((0 + 36) / 2);
  });
});

describe("computeHandicapEvolution", () => {
  it("filtra partidas sin hándicap y ordena cronológicamente (más antigua primero)", () => {
    const rounds = [
      flatRound(9, 0, { date: new Date("2026-03-01"), handicapIndex: 14 }),
      flatRound(9, 0, { date: new Date("2026-02-01"), handicapIndex: null }),
      flatRound(9, 0, { date: new Date("2026-01-01"), handicapIndex: 16 }),
    ];
    const evolution = computeHandicapEvolution(rounds);
    expect(evolution).toEqual([
      { date: new Date("2026-01-01"), handicapIndex: 16 },
      { date: new Date("2026-03-01"), handicapIndex: 14 },
    ]);
  });
});

describe("computePlayerStats", () => {
  it("compone todas las piezas en un único objeto", () => {
    const rounds = [flatRound(18, 0), flatRound(18, 1), flatRound(18, -1)];
    const stats = computePlayerStats(rounds);
    expect(stats.completedRounds).toBe(3);
    expect(stats.breakdown).toBeDefined();
    expect(stats.byCourse).toHaveLength(1);
    expect(stats.byFormat).toHaveLength(1);
    expect(stats.byHolePar).toHaveLength(1);
    expect(stats.handicapEvolution).toEqual([]);
  });
});
