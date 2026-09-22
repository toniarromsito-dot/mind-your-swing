import { afterEach, describe, expect, it } from "vitest";
import { hasProAccess } from "@/lib/plan";

/**
 * Fase 11B — Subscription Foundation. hasProAccess() sigue siendo el único
 * punto de entitlement (ver plan.ts): estos tests documentan exactamente su
 * contrato para que ninguna feature futura necesite reinventar la lógica.
 */
describe("hasProAccess", () => {
  const ORIGINAL_OWNER_EMAILS = process.env.OWNER_EMAILS;

  afterEach(() => {
    process.env.OWNER_EMAILS = ORIGINAL_OWNER_EMAILS;
  });

  it("1. un usuario FREE no tiene acceso Pro", () => {
    expect(hasProAccess({ plan: "FREE", email: "free@example.com" })).toBe(false);
  });

  it("2. un usuario PRO tiene acceso Pro", () => {
    expect(hasProAccess({ plan: "PRO", email: "pro@example.com" })).toBe(true);
  });

  it("3. el bypass del owner sigue funcionando aunque el plan en BD sea FREE", () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    expect(hasProAccess({ plan: "FREE", email: "owner@example.com" })).toBe(true);
  });

  it("el bypass de owner es por email exacto (case-insensitive) — no da acceso a otros emails", () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    expect(hasProAccess({ plan: "FREE", email: "OWNER@EXAMPLE.COM" })).toBe(true);
    expect(hasProAccess({ plan: "FREE", email: "notowner@example.com" })).toBe(false);
  });

  it("un usuario sin email (null) nunca obtiene el bypass de owner", () => {
    process.env.OWNER_EMAILS = "owner@example.com";
    expect(hasProAccess({ plan: "FREE", email: null })).toBe(false);
  });

  it("sin OWNER_EMAILS configurado, ningún email activa el bypass", () => {
    delete process.env.OWNER_EMAILS;
    expect(hasProAccess({ plan: "FREE", email: "owner@example.com" })).toBe(false);
  });
});
