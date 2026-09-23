import Stripe from "stripe";
import type { SubscriptionStatus } from "@prisma/client";
import type { BillingInterval } from "@prisma/client";

// apiVersion se omite a propósito: el SDK usa la versión con la que se
// generó (ver node_modules/stripe/cjs/apiVersion.js), evitando fijar aquí
// un string que quede desactualizado.
//
// El SDK lanza un error en el propio constructor si la key está vacía
// (a diferencia del de Anthropic), así que sin STRIPE_SECRET_KEY usamos un
// placeholder: nunca se llega a usar de verdad porque todas las rutas que
// tocan Stripe comprueban isStripeConfigured() antes.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_not_configured");

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRO_PRICE_ID_MONTHLY &&
      process.env.STRIPE_PRO_PRICE_ID_ANNUAL
  );
}

// Un Price ID por intervalo de facturación — nunca hardcodeados en
// componentes/acciones. Fase 11B: PRO mensual = 14,99 €, PRO anual = 143,90 €
// (ambos configurados en el dashboard de Stripe, no en este código).
// Función (no un objeto de nivel de módulo) a propósito: leer
// process.env en cada llamada, igual que isStripeConfigured(), evita
// depender de en qué orden se evalúan los módulos — importante sobre todo
// en tests, que fijan estas variables antes de cada caso.
export function proPriceId(interval: BillingInterval): string | undefined {
  return interval === "MONTHLY"
    ? process.env.STRIPE_PRO_PRICE_ID_MONTHLY
    : process.env.STRIPE_PRO_PRICE_ID_ANNUAL;
}

export function billingIntervalFromPriceId(priceId: string | null | undefined): BillingInterval | null {
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID_MONTHLY) return "MONTHLY";
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID_ANNUAL) return "ANNUAL";
  return null;
}

// Fase 11E — pack de Voice: compra ÚNICA (mode: "payment"), nunca una
// suscripción, así que deliberadamente NO se exige junto a
// isStripeConfigured() (los packs deben poder activarse/desactivarse sin
// afectar al checkout de Pro, y viceversa).
export function isVoicePackConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_VOICE_PACK_PRICE_ID);
}

export function voicePackPriceId(): string | undefined {
  return process.env.STRIPE_VOICE_PACK_PRICE_ID;
}

/**
 * Normaliza los `status` que devuelve Stripe (incomplete, incomplete_expired,
 * trialing, active, past_due, canceled, unpaid y, en cuentas más nuevas,
 * paused) al SubscriptionStatus propio del schema. Cualquier valor no
 * reconocido —incluido "paused", sin equivalente 1:1 pedido para esta
 * fase— cae a INCOMPLETE: política deliberadamente conservadora, un status
 * que no entendemos nunca debe traducirse en conceder Pro por accidente.
 */
export function normalizeStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "unpaid":
      return "UNPAID";
    default:
      console.error(`Stripe subscription status sin mapeo conocido: "${status}" — normalizado a INCOMPLETE.`);
      return "INCOMPLETE";
  }
}

/**
 * Único lugar que decide qué estados de suscripción conceden acceso Pro.
 * PAST_DUE se trata deliberadamente como "sin acceso" (política de esta
 * fase, sin periodo de gracia propio — ver documento de especificación,
 * sección de riesgos): el pago ha fallado, así que no se concede Pro hasta
 * que Stripe confirme un estado ACTIVE/TRIALING de nuevo.
 */
export function isProStatus(status: SubscriptionStatus): boolean {
  return status === "ACTIVE" || status === "TRIALING";
}
