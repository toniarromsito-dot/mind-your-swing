import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapRevenueCatEvent, verifyRevenueCatSignature } from "./revenuecat";

/**
 * Fase 12C — funciones puras de RevenueCat: verificación de firma HMAC
 * (mismo mecanismo "t=...,v1=..." documentado oficialmente, ver
 * src/lib/revenuecat.ts) y mapeo de eventos a nuestro SubscriptionStatus.
 */
describe("verifyRevenueCatSignature", () => {
  const secret = "whsec_test_revenuecat";

  function sign(body: string, secretKey: string, tSeconds = Math.floor(Date.now() / 1000)) {
    const hmac = createHmac("sha256", secretKey).update(`${tSeconds}.${body}`).digest("hex");
    return `t=${tSeconds},v1=${hmac}`;
  }

  it("acepta una firma válida y reciente", () => {
    const body = JSON.stringify({ event: { id: "evt_1" } });
    const header = sign(body, secret);
    expect(verifyRevenueCatSignature(body, header, secret)).toBe(true);
  });

  it("rechaza sin cabecera", () => {
    expect(verifyRevenueCatSignature("{}", null, secret)).toBe(false);
  });

  it("rechaza una firma calculada con el secreto equivocado", () => {
    const body = JSON.stringify({ event: { id: "evt_1" } });
    const header = sign(body, "otro-secreto-distinto");
    expect(verifyRevenueCatSignature(body, header, secret)).toBe(false);
  });

  it("rechaza si el cuerpo cambia después de firmar (bytes distintos)", () => {
    const body = JSON.stringify({ event: { id: "evt_1" } });
    const header = sign(body, secret);
    const tampered = JSON.stringify({ event: { id: "evt_2" } });
    expect(verifyRevenueCatSignature(tampered, header, secret)).toBe(false);
  });

  it("rechaza una cabecera mal formada (sin t o sin v1)", () => {
    expect(verifyRevenueCatSignature("{}", "v1=abc", secret)).toBe(false);
    expect(verifyRevenueCatSignature("{}", "t=123", secret)).toBe(false);
  });

  it("rechaza una firma demasiado antigua (replay)", () => {
    const body = JSON.stringify({ event: { id: "evt_1" } });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 60 * 60; // 1h en el pasado
    const header = sign(body, secret, oldTimestamp);
    expect(verifyRevenueCatSignature(body, header, secret)).toBe(false);
  });
});

describe("mapRevenueCatEvent", () => {
  it("INITIAL_PURCHASE/RENEWAL fuera de trial → ACTIVE", () => {
    expect(mapRevenueCatEvent("INITIAL_PURCHASE", null)).toMatchObject({ status: "ACTIVE", relevant: true });
    expect(mapRevenueCatEvent("RENEWAL", null)).toMatchObject({ status: "ACTIVE", relevant: true });
  });

  it("INITIAL_PURCHASE con period_type TRIAL → TRIALING", () => {
    expect(mapRevenueCatEvent("INITIAL_PURCHASE", "TRIAL")).toMatchObject({ status: "TRIALING", relevant: true });
  });

  it("EXPIRATION → CANCELED, corta el acceso de forma inequívoca", () => {
    expect(mapRevenueCatEvent("EXPIRATION", null)).toMatchObject({ status: "CANCELED", relevant: true });
  });

  it("CANCELLATION → NO cambia status (política conservadora), solo marca cancelAtPeriodEnd", () => {
    const effect = mapRevenueCatEvent("CANCELLATION", null);
    expect(effect.status).toBeUndefined();
    expect(effect.cancelAtPeriodEnd).toBe(true);
    expect(effect.relevant).toBe(true);
  });

  it("BILLING_ISSUE → PAST_DUE, misma política que Stripe (sin gracia)", () => {
    expect(mapRevenueCatEvent("BILLING_ISSUE", null)).toMatchObject({ status: "PAST_DUE", relevant: true });
  });

  it("SUBSCRIPTION_PAUSED (solo Google Play) → PAST_DUE", () => {
    expect(mapRevenueCatEvent("SUBSCRIPTION_PAUSED", null)).toMatchObject({ status: "PAST_DUE", relevant: true });
  });

  it("eventos no relevantes para el entitlement de PRO se reconocen pero no tocan status", () => {
    for (const type of [
      "NON_RENEWING_PURCHASE",
      "TEMPORARY_ENTITLEMENT_GRANT",
      "VIRTUAL_CURRENCY_TRANSACTION",
      "EXPERIMENT_ENROLLMENT",
      "PURCHASE_REDEEMED",
      "SUBSCRIBER_ALIAS",
      "PRICE_INCREASE_CONSENT_REQUIRED",
      "TEST",
      "UN_EVENTO_QUE_NO_EXISTE_TODAVIA",
    ]) {
      const effect = mapRevenueCatEvent(type, null);
      expect(effect.relevant).toBe(false);
      expect(effect.status).toBeUndefined();
    }
  });
});
