import { describe, expect, it } from "vitest";
import { shouldSkipReloadOnResume } from "./resume-guard";

describe("shouldSkipReloadOnResume", () => {
  it("salta la recarga con partida activa y sin conectividad", () => {
    expect(shouldSkipReloadOnResume("game_1", "offline")).toBe(true);
  });

  it("recarga con partida activa pero con conectividad", () => {
    expect(shouldSkipReloadOnResume("game_1", "online")).toBe(false);
  });

  it("recarga sin partida activa aunque esté offline", () => {
    expect(shouldSkipReloadOnResume(null, "offline")).toBe(false);
  });

  it("recarga sin partida activa y con conectividad", () => {
    expect(shouldSkipReloadOnResume(null, "online")).toBe(false);
  });
});
