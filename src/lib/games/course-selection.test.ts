import { describe, expect, it } from "vitest";
import { resolveGameHoles, type TeeHoleInput } from "./course-selection";

function makeHoles(count: number): TeeHoleInput[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
    index: i + 1,
    distance: 300 + i,
  }));
}

describe("resolveGameHoles", () => {
  it("uses all 18 real holes for an 18-hole layout when 18 is requested (e.g. Santa Ponsa I/II), without duplicating", () => {
    const result = resolveGameHoles(makeHoles(18), 18);
    expect(result.effectiveHoleCount).toBe(18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(false);
    expect(result.holes.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    // Sin duplicados: cada hoyo de un recorrido de 18 tiene par/índice/distancia propios.
    expect(new Set(result.holes.map((h) => h.distance)).size).toBe(18);
  });

  it("uses the first 9 real holes for an 18-hole layout when 9 is requested", () => {
    const result = resolveGameHoles(makeHoles(18), 9);
    expect(result.effectiveHoleCount).toBe(9);
    expect(result.holes).toHaveLength(9);
    expect(result.holes.map((h) => h.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.doubledNineHoles).toBe(false);
  });

  it("uses the real 9 holes for a genuinely 9-hole layout when 9 is requested (Pollença)", () => {
    const result = resolveGameHoles(makeHoles(9), 9);
    expect(result.effectiveHoleCount).toBe(9);
    expect(result.holes).toHaveLength(9);
    expect(result.doubledNineHoles).toBe(false);
  });

  it("Pollença a 18: juega la misma tarjeta de 9 dos veces como GameHole 1-18, sin inventar hoyos nuevos", () => {
    const nineHoleTee = makeHoles(9);
    const result = resolveGameHoles(nineHoleTee, 18);
    expect(result.effectiveHoleCount).toBe(18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(true);
    expect(result.holes.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    // GameHole 10-18 (segunda vuelta) tienen exactamente los mismos datos del tee real que 1-9.
    for (let i = 0; i < 9; i++) {
      const firstLoopHole = result.holes[i];
      const secondLoopHole = result.holes[i + 9];
      expect(secondLoopHole.par).toBe(firstLoopHole.par);
      expect(secondLoopHole.index).toBe(firstLoopHole.index);
      expect(secondLoopHole.distance).toBe(firstLoopHole.distance);
      expect(secondLoopHole.number).toBe(firstLoopHole.number + 9);
    }
  });

  it("Santa Ponsa III a 18: misma regla de segunda vuelta que Pollença", () => {
    const result = resolveGameHoles(makeHoles(9), 18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(true);
  });

  it("Palma Pitch & Putt a 18: misma regla de segunda vuelta", () => {
    const result = resolveGameHoles(makeHoles(9), 18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(true);
  });

  it("falls back par to 4 when a tee hole has no verified par", () => {
    const holes: TeeHoleInput[] = [{ number: 1, par: null, index: null, distance: null }];
    const result = resolveGameHoles(holes, 9);
    expect(result.holes[0]).toEqual({ number: 1, par: 4, index: null, distance: null });
  });

  it("sorts holes by number regardless of input order before doubling", () => {
    const nine = makeHoles(9);
    const shuffled = [nine[8], nine[0], nine[3], ...nine.slice(1, 3), ...nine.slice(4, 8)];
    const result = resolveGameHoles(shuffled, 18);
    expect(result.holes.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(result.holes[0].distance).toBe(nine[0].distance);
    expect(result.holes[9].distance).toBe(nine[0].distance);
  });
});
