import { afterEach, describe, expect, it } from "vitest";
import { canUseFeature, type Feature } from "@/lib/entitlements";

/**
 * Fase 11C — matriz FREE/PRO completa vía la capa de capacidades. Un solo
 * test recorre TODAS las features Pro conocidas — si se añade una nueva
 * capacidad a la lista de abajo sin darle cobertura, este test la detecta
 * (test "cada feature Pro..."), en vez de depender de acordarse de añadir
 * un `it()` nuevo cada vez.
 */
const ALL_PRO_FEATURES: Feature[] = [
  "COACH_MEMORY",
  "ADVANCED_INSIGHTS",
  "PROACTIVE_INSIGHTS",
  "SWING_AI",
  "LEARN_VIDEOS",
  "COMMUNITY_REPLIES",
  "VOICE_PRO",
  "ADVANCED_GAME_CREATION",
  "AD_FREE",
];

describe("canUseFeature", () => {
  const ORIGINAL_OWNER_EMAILS = process.env.OWNER_EMAILS;
  afterEach(() => {
    process.env.OWNER_EMAILS = ORIGINAL_OWNER_EMAILS;
  });

  it("1. un usuario FREE no tiene acceso a ninguna feature Pro", () => {
    for (const feature of ALL_PRO_FEATURES) {
      expect(canUseFeature({ plan: "FREE", email: "free@example.com" }, feature)).toBe(false);
    }
  });

  it("1. un usuario PRO tiene acceso a todas las features Pro", () => {
    for (const feature of ALL_PRO_FEATURES) {
      expect(canUseFeature({ plan: "PRO", email: "pro@example.com" }, feature)).toBe(true);
    }
  });

  it("2. el bypass de owner concede todas las features Pro aunque el plan en BD sea FREE", () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    for (const feature of ALL_PRO_FEATURES) {
      expect(canUseFeature({ plan: "FREE", email: "owner@example.com" }, feature)).toBe(true);
    }
  });

  it("6. FREE → Swing AI DENIED", () => {
    expect(canUseFeature({ plan: "FREE", email: null }, "SWING_AI")).toBe(false);
  });

  it("7. PRO → Swing AI permitido", () => {
    expect(canUseFeature({ plan: "PRO", email: null }, "SWING_AI")).toBe(true);
  });

  it("9. FREE → Community comments (COMMUNITY_REPLIES) DENIED", () => {
    expect(canUseFeature({ plan: "FREE", email: null }, "COMMUNITY_REPLIES")).toBe(false);
  });

  it("10. PRO → Community comments (COMMUNITY_REPLIES) OK", () => {
    expect(canUseFeature({ plan: "PRO", email: null }, "COMMUNITY_REPLIES")).toBe(true);
  });

  it("12/13. FREE → advanced feature (ADVANCED_INSIGHTS) DENIED, PRO → OK", () => {
    expect(canUseFeature({ plan: "FREE", email: null }, "ADVANCED_INSIGHTS")).toBe(false);
    expect(canUseFeature({ plan: "PRO", email: null }, "ADVANCED_INSIGHTS")).toBe(true);
  });
});
