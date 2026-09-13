import { describe, expect, it } from "vitest";
import { computeNetResult, strokesReceivedOnHole } from "./handicap";

describe("strokesReceivedOnHole", () => {
  it("gives one stroke on a hole whose index is within the handicap (the user's own example)", () => {
    // Hándicap 14 · Hoyo par 4 · SI 3 → recibe 1 golpe.
    expect(strokesReceivedOnHole(14, 3)).toBe(1);
  });

  it("gives no extra stroke on a hole whose index is above the handicap", () => {
    expect(strokesReceivedOnHole(14, 15)).toBe(0);
  });

  it("gives a second stroke on the hardest holes once handicap exceeds 18", () => {
    expect(strokesReceivedOnHole(20, 2)).toBe(2); // 1 full round + index 2 <= remainder 2
    expect(strokesReceivedOnHole(20, 5)).toBe(1); // 1 full round, index 5 > remainder 2
  });

  it("treats zero or negative handicap as receiving no strokes", () => {
    expect(strokesReceivedOnHole(0, 1)).toBe(0);
    expect(strokesReceivedOnHole(-2, 1)).toBe(0);
  });

  it("rounds a fractional handicap before allocating", () => {
    expect(strokesReceivedOnHole(14.6, 3)).toBe(1); // rounds to 15, still 1 full round below 18
  });
});

describe("computeNetResult", () => {
  it("subtracts strokes received across played holes from the gross total", () => {
    const holes = [
      { par: 4, index: 3, strokes: 5 }, // hcp 14 -> receives 1 -> net 4
      { par: 4, index: 15, strokes: 5 }, // receives 0 -> net 5
    ];
    const result = computeNetResult(holes, 14);
    expect(result).toEqual({ net: 9, strokesReceived: 1, parPlayed: 8 });
  });

  it("ignores holes without a recorded score", () => {
    const holes = [
      { par: 4, index: 3, strokes: 5 },
      { par: 4, index: 10, strokes: null },
    ];
    const result = computeNetResult(holes, 14);
    expect(result?.parPlayed).toBe(4);
  });

  it("returns null when the player has no declared handicap", () => {
    const holes = [{ par: 4, index: 3, strokes: 5 }];
    expect(computeNetResult(holes, null)).toBeNull();
  });

  it("returns null when no played hole has stroke-index data (custom course)", () => {
    const holes = [{ par: 4, index: null, strokes: 5 }];
    expect(computeNetResult(holes, 14)).toBeNull();
  });
});
