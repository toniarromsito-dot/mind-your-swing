import { createHmac, timingSafeEqual } from "node:crypto";
import type { SubscriptionStatus } from "@prisma/client";

/**
 * Fase 12C — RevenueCat (iOS/Android vía App Store/Google Play). Stripe
 * sigue siendo exclusivo de la web — este módulo nunca lo sustituye, solo
 * añade el segundo camino que termina en la MISMA Subscription/User.plan
 * (ver src/lib/subscription.ts → recomputeUserPlan()).
 */

export function isRevenueCatConfigured(): boolean {
  return Boolean(process.env.REVENUECAT_WEBHOOK_SECRET);
}

// Tolerancia de antigüedad de la firma — mismo criterio que un replay window
// razonable (5 min), documentado así por RevenueCat para su propio ejemplo
// de verificación.
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

/**
 * Verifica `X-RevenueCat-Webhook-Signature: t=<unix_ts>,v1=<hmac_sha256_hex>`.
 * El HMAC-SHA256 se calcula sobre `"<timestamp>.<raw_json_body>"` — el
 * cuerpo EXACTO recibido, nunca un JSON.stringify() de después de parsear
 * (cambiaría los bytes y rompería la verificación) — verificado contra la
 * documentación oficial de RevenueCat, no inventado.
 */
export function verifyRevenueCatSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const parts = new Map(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v] as const;
    })
  );
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;

  const timestampMs = Number(t) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(Date.now() - timestampMs) > SIGNATURE_MAX_AGE_MS) return false;

  const expectedHex = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(v1, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export type RevenueCatStatusEffect = {
  /** undefined = este evento no cambia el status actual de la fila. */
  status?: SubscriptionStatus;
  /** undefined = no toca cancelAtPeriodEnd. */
  cancelAtPeriodEnd?: boolean;
  /** false = evento reconocido y guardado en SubscriptionEvent (auditoría), pero no afecta a la Subscription/entitlement en absoluto. */
  relevant: boolean;
};

/**
 * Mapea un evento de RevenueCat a un efecto sobre nuestra Subscription.
 *
 * Fase 12D.1 — política de CANCELLATION resuelta (ya no es una limitación
 * conocida): RevenueCat expone `cancel_reason` en el evento CANCELLATION,
 * verificado contra la documentación oficial actual
 * (docs.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
 * con estos valores reales: UNSUBSCRIBE, BILLING_ERROR, DEVELOPER_INITIATED,
 * PRICE_INCREASE, CUSTOMER_SUPPORT, UNKNOWN. Un reembolso genera SIEMPRE un
 * CANCELLATION con cancel_reason=CUSTOMER_SUPPORT — es la única señal
 * fiable para distinguir "dejó de renovar" (conserva acceso hasta
 * EXPIRATION) de "reembolso/revoke" (pierde acceso YA). Decisión de
 * producto confirmada:
 *
 *   - CANCELLATION con cancel_reason=CUSTOMER_SUPPORT → status=CANCELED
 *     de inmediato (refund real).
 *   - CANCELLATION con cualquier otro cancel_reason (o ausente) →
 *     cancelAtPeriodEnd=true, status SIN CAMBIAR — el EXPIRATION posterior
 *     es quien corta el acceso de verdad, igual que ya hace Stripe con
 *     cancel_at_period_end. Nunca "CANCELLATION = FREE inmediato" como
 *     regla genérica — eso rompería la cancelación normal de renovación.
 *
 * BILLING_ISSUE es un evento DISTINTO (no un cancel_reason de
 * CANCELLATION) — nunca se mezcla con la lógica de refund de arriba, sigue
 * su propia rama con la política ya existente de MYS.
 */
export function mapRevenueCatEvent(
  eventType: string,
  periodType: string | null | undefined,
  cancelReason?: string | null
): RevenueCatStatusEffect {
  const activeOrTrialing: SubscriptionStatus = periodType === "TRIAL" ? "TRIALING" : "ACTIVE";

  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED":
    case "REFUND_REVERSED":
      return { status: activeOrTrialing, cancelAtPeriodEnd: false, relevant: true };

    case "TRANSFER":
      // Efecto sobre la cuenta DESTINO (transferred_to). Best-effort: la
      // tratamos como si acabara de comprar/renovar — el payload no trae
      // el estado de la suscripción transferida. La cuenta ORIGEN
      // (transferred_from) la cierra el webhook aparte (TRANSFERRED_AWAY
      // en api/revenuecat/webhook/route.ts).
      return { status: activeOrTrialing, cancelAtPeriodEnd: false, relevant: true };

    case "CANCELLATION":
      if (cancelReason === "CUSTOMER_SUPPORT") {
        // Reembolso/revoke real — corta el acceso ya, no espera a EXPIRATION.
        return { status: "CANCELED", cancelAtPeriodEnd: true, relevant: true };
      }
      // Cancelación normal de renovación (UNSUBSCRIBE/BILLING_ERROR/
      // DEVELOPER_INITIATED/PRICE_INCREASE/UNKNOWN/ausente) — conserva
      // acceso hasta que llegue el EXPIRATION real.
      return { cancelAtPeriodEnd: true, relevant: true };

    case "EXPIRATION":
      return { status: "CANCELED", cancelAtPeriodEnd: true, relevant: true };

    case "BILLING_ISSUE":
      // Misma política que Stripe: sin periodo de gracia propio, sin acceso
      // hasta que el pago se resuelva y llegue un RENEWAL/UNCANCELLATION.
      return { status: "PAST_DUE", relevant: true };

    case "SUBSCRIPTION_PAUSED":
      // Solo existe en Google Play (Apple no tiene "pausa"). Sin acceso
      // mientras está pausada — mismo criterio conservador que BILLING_ISSUE.
      return { status: "PAST_DUE", relevant: true };

    // Eventos reales de RevenueCat que no representan un cambio de estado
    // de ESTA suscripción de PRO — se guardan en SubscriptionEvent para
    // auditoría (idempotencia ya cerrada antes de llegar aquí) pero no
    // tocan Subscription/User.plan en absoluto.
    case "NON_RENEWING_PURCHASE": // compra no-suscripción — MYS no vende IAP de un solo uso para PRO
    case "TEMPORARY_ENTITLEMENT_GRANT":
    case "VIRTUAL_CURRENCY_TRANSACTION":
    case "EXPERIMENT_ENROLLMENT":
    case "PURCHASE_REDEEMED":
    case "SUBSCRIBER_ALIAS": // deprecado por el propio RevenueCat
    case "PRICE_INCREASE_CONSENT_REQUIRED":
    case "PRICE_INCREASE_CONSENT_APPROVED":
    case "TEST":
    default:
      return { relevant: false };
  }
}
