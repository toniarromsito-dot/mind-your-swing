import { describe, expect, it } from "vitest";
import { computeClosingPressureInsight, computeMentalTrendInsight, computeRecoveryInsight } from "./insights";

describe("computeMentalTrendInsight", () => {
  it("reuses computeMentalScore and reports an up trend", () => {
    const entries = [
      { mood: "CONFIADO" as const },
      { mood: "CONCENTRADO" as const },
      { mood: "CONFIADO" as const },
      { mood: "FRUSTRADO" as const },
      { mood: "NERVIOSO" as const },
      { mood: "FRUSTRADO" as const },
    ];
    expect(computeMentalTrendInsight(entries)).toEqual({ trend: "up" });
  });

  it("returns null when the trend is flat (no interesting insight to show)", () => {
    expect(computeMentalTrendInsight([{ mood: "TRANQUILO" }, { mood: "TRANQUILO" }])).toBeNull();
  });

  it("returns null with no mood data at all", () => {
    expect(computeMentalTrendInsight([])).toBeNull();
  });
});

describe("computeRecoveryInsight", () => {
  it("returns null below the minimum sample size", () => {
    expect(computeRecoveryInsight([{ recovered: true }, { recovered: false }])).toBeNull();
  });

  it("detects faster recovery recently than before", () => {
    const events = [
      // más reciente primero
      { recovered: true },
      { recovered: true },
      { recovered: true },
      { recovered: false },
      { recovered: false },
      { recovered: false },
    ];
    const result = computeRecoveryInsight(events);
    expect(result).toEqual({ trend: "up", recentRate: 1, olderRate: 0 });
  });

  it("returns null when the recovery rate barely changed", () => {
    const events = [
      // recent: 2/3 recovered
      { recovered: true },
      { recovered: true },
      { recovered: false },
      // older: 2/3 recovered — same rate, no real trend
      { recovered: true },
      { recovered: true },
      { recovered: false },
    ];
    expect(computeRecoveryInsight(events)).toBeNull();
  });
});

describe("computeClosingPressureInsight", () => {
  it("returns null below the minimum sample size in either group", () => {
    const close = [{ mood: "NERVIOSO" as const }, { mood: "NERVIOSO" as const }];
    const rest = [{ mood: "TRANQUILO" as const }, { mood: "TRANQUILO" as const }, { mood: "TRANQUILO" as const }];
    expect(computeClosingPressureInsight(close, rest)).toBeNull();
  });

  it("detects meaningfully higher pressure in the closing holes", () => {
    const close = [{ mood: "NERVIOSO" as const }, { mood: "FRUSTRADO" as const }, { mood: "NERVIOSO" as const }, { mood: "TRANQUILO" as const }];
    const rest = [{ mood: "TRANQUILO" as const }, { mood: "CONFIADO" as const }, { mood: "CONCENTRADO" as const }, { mood: "TRANQUILO" as const }];
    const result = computeClosingPressureInsight(close, rest);
    expect(result).toEqual({ closeFrequency: 0.75, restFrequency: 0 });
  });

  it("returns null when pressure isn't meaningfully different between groups", () => {
    const close = [{ mood: "TRANQUILO" as const }, { mood: "CONFIADO" as const }, { mood: "NERVIOSO" as const }];
    const rest = [{ mood: "TRANQUILO" as const }, { mood: "CONFIADO" as const }, { mood: "NERVIOSO" as const }];
    expect(computeClosingPressureInsight(close, rest)).toBeNull();
  });
});
