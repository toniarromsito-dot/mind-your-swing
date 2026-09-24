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
 * LIMITACIÓN CONOCIDA, sin resolver a propósito (Fase 12C, sección 12: "si
 * detectas una diferencia entre el modelo Stripe y RevenueCat, detente y
 * explícalo antes de inventar una equivalencia"):
 *
 * CANCELLATION en RevenueCat cubre DOS casos distintos con el mismo tipo de
 * evento — "el usuario desactivó la renovación automática" (debe conservar
 * acceso hasta `expiration_at_ms`) y "reembolso" (debería perder acceso
 * YA) — y el payload documentado no da un campo inequívoco para
 * distinguirlos de forma fiable sin investigación adicional. Se trata aquí
 * de la forma CONSERVADORA: igual que ya hace Stripe hoy con
 * `cancel_at_period_end`, CANCELLATION solo marca `cancelAtPeriodEnd=true`
 * y NO cambia `status` — el EXPIRATION posterior (inequívoco, siempre
 * corta acceso) es quien de verdad revoca el PRO. Si un reembolso real
 * debe cortar el acceso de inmediato en vez de esperar a EXPIRATION, este
 * mapeo debe revisarse ANTES de procesar tráfico de producción — no se ha
 * decidido ni implementado esa distinción todavía.
 */
export function mapRevenueCatEvent(
  eventType: string,
  periodType: string | null | undefined
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
      // Best-effort: tratamos al app_user_id destino como si acabara de
      // comprar/renovar. No tenemos en este payload suficiente detalle
      // para distinguir matices adicionales de una transferencia — ver
      // informe de la fase.
      return { status: activeOrTrialing, cancelAtPeriodEnd: false, relevant: true };

    case "CANCELLATION":
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
