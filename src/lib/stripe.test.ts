import { afterEach, describe, expect, it } from "vitest";
import { billingIntervalFromPriceId, isProStatus, normalizeStripeStatus } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * Fase 11B — Subscription Foundation. Estas funciones son la única capa de
 * normalización entre los status/price IDs reales de Stripe y el
 * SubscriptionStatus/BillingInterval propios del schema — cualquier
 * decisión de "¿esto concede Pro?" pasa por aquí, nunca por una
 * comparación de string suelta en otro archivo.
 */
describe("normalizeStripeStatus", () => {
  const cases: [Stripe.Subscription.Status, string][] = [
    ["active", "ACTIVE"],
    ["trialing", "TRIALING"],
    ["past_due", "PAST_DUE"],
    ["canceled", "CANCELED"],
    ["incomplete", "INCOMPLETE"],
    ["incomplete_expired", "INCOMPLETE_EXPIRED"],
    ["unpaid", "UNPAID"],
  ];

  for (const [input, expected] of cases) {
    it(`mapea "${input}" a ${expected}`, () => {
      expect(normalizeStripeStatus(input)).toBe(expected);
    });
  }

  it("un status de Stripe no reconocido (p.ej. 'paused') cae a INCOMPLETE de forma segura", () => {
    expect(normalizeStripeStatus("paused" as Stripe.Subscription.Status)).toBe("INCOMPLETE");
  });
});

describe("isProStatus — 6/7/8/9: qué estados conceden acceso Pro", () => {
  it("6. ACTIVE concede acceso Pro", () => {
    expect(isProStatus("ACTIVE")).toBe(true);
  });

  it("7. TRIALING concede acceso Pro", () => {
    expect(isProStatus("TRIALING")).toBe(true);
  });

  it("8. CANCELED no concede acceso Pro", () => {
    expect(isProStatus("CANCELED")).toBe(false);
  });

  it("9. PAST_DUE no concede acceso Pro (política de esta fase: sin periodo de gracia propio)", () => {
    expect(isProStatus("PAST_DUE")).toBe(false);
  });

  it("INCOMPLETE / INCOMPLETE_EXPIRED / UNPAID no conceden acceso Pro", () => {
    expect(isProStatus("INCOMPLETE")).toBe(false);
    expect(isProStatus("INCOMPLETE_EXPIRED")).toBe(false);
    expect(isProStatus("UNPAID")).toBe(false);
  });
});

describe("billingIntervalFromPriceId", () => {
  const ORIGINAL_MONTHLY = process.env.STRIPE_PRO_PRICE_ID_MONTHLY;
  const ORIGINAL_ANNUAL = process.env.STRIPE_PRO_PRICE_ID_ANNUAL;

  afterEach(() => {
    process.env.STRIPE_PRO_PRICE_ID_MONTHLY = ORIGINAL_MONTHLY;
    process.env.STRIPE_PRO_PRICE_ID_ANNUAL = ORIGINAL_ANNUAL;
  });

  it("reconoce el price ID mensual configurado", () => {
    process.env.STRIPE_PRO_PRICE_ID_MONTHLY = "price_monthly_123";
    process.env.STRIPE_PRO_PRICE_ID_ANNUAL = "price_annual_456";
    expect(billingIntervalFromPriceId("price_monthly_123")).toBe("MONTHLY");
  });

  it("reconoce el price ID anual configurado", () => {
    process.env.STRIPE_PRO_PRICE_ID_MONTHLY = "price_monthly_123";
    process.env.STRIPE_PRO_PRICE_ID_ANNUAL = "price_annual_456";
    expect(billingIntervalFromPriceId("price_annual_456")).toBe("ANNUAL");
  });

  it("un price ID desconocido no se asume mensual ni anual", () => {
    process.env.STRIPE_PRO_PRICE_ID_MONTHLY = "price_monthly_123";
    process.env.STRIPE_PRO_PRICE_ID_ANNUAL = "price_annual_456";
    expect(billingIntervalFromPriceId("price_otro_789")).toBeNull();
  });

  it("null/undefined nunca se resuelve a un intervalo", () => {
    expect(billingIntervalFromPriceId(null)).toBeNull();
    expect(billingIntervalFromPriceId(undefined)).toBeNull();
  });
});
