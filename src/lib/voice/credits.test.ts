import { describe, expect, it, vi } from "vitest";
import { currentVoicePeriod, VOICE_INCLUDED_SECONDS, VOICE_PACK_SECONDS } from "./credits";

/**
 * Fase 11E — Voice Credits. Piezas puras: límites por plan (siempre en
 * segundos, nunca en decimal) y el cálculo del periodo natural.
 */
describe("VOICE_INCLUDED_SECONDS", () => {
  it("FREE = 5 min = 300s", () => {
    expect(VOICE_INCLUDED_SECONDS.FREE).toBe(300);
  });

  it("PRO = 40 min = 2400s", () => {
    expect(VOICE_INCLUDED_SECONDS.PRO).toBe(2400);
  });
});

it("VOICE_PACK_SECONDS = 60 min = 3600s, nunca en decimal", () => {
  expect(VOICE_PACK_SECONDS).toBe(3600);
  expect(Number.isInteger(VOICE_PACK_SECONDS)).toBe(true);
});

describe("currentVoicePeriod", () => {
  it("devuelve el formato YYYY-MM del mes en curso", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00Z"));
    expect(currentVoicePeriod()).toBe("2026-03");
    vi.useRealTimers();
  });

  it("rellena el mes con cero a la izquierda", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(currentVoicePeriod()).toBe("2026-01");
    vi.useRealTimers();
  });
});
