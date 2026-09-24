import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isRevenueCatConfigured,
  mapRevenueCatEvent,
  verifyRevenueCatSignature,
  type RevenueCatStatusEffect,
} from "@/lib/revenuecat";
import { recomputeUserPlan } from "@/lib/subscription";

export const runtime = "nodejs";

/**
 * Fase 12C — webhook de RevenueCat (iOS/Android). Mismo nivel de rigor que
 * el webhook de Stripe (route.ts hermano en api/stripe/webhook): firma
 * verificada, idempotencia real vía SubscriptionEvent.providerEventId,
 * fail-closed si el usuario no existe, guarda de orden atómica igual que
 * Stripe. Escribe EXCLUSIVAMENTE la fila Subscription(provider=REVENUECAT)
 * del usuario — nunca toca la fila STRIPE, que sigue siendo responsabilidad
 * exclusiva del webhook de Stripe.
 */
type RevenueCatWebhookEvent = {
  id: string;
  type: string;
  /** Ausente en TRANSFER — ese evento solo trae transferred_from/transferred_to (ver docs de RevenueCat). */
  app_user_id?: string;
  original_app_user_id?: string;
  original_transaction_id?: string;
  store?: string;
  period_type?: string;
  /** Solo presente en eventos CANCELLATION — ver mapRevenueCatEvent() para la política de refund (Fase 12D.1). */
  cancel_reason?: string;
  /** Solo en TRANSFER. */
  transferred_from?: string[];
  transferred_to?: string[];
  event_timestamp_ms: number;
};

/**
 * Efecto sobre la cuenta ORIGEN de un TRANSFER: la suscripción ya no le
 * pertenece, así que su fila REVENUECAT deja de conceder PRO. Sin esto la
 * cuenta origen seguiría PRO para siempre — nunca le llegaría el
 * EXPIRATION, que a partir de ahora se emite para la cuenta destino.
 */
const TRANSFERRED_AWAY: RevenueCatStatusEffect = { status: "CANCELED", cancelAtPeriodEnd: true, relevant: true };

async function applyRevenueCatEvent(
  userId: string,
  event: RevenueCatWebhookEvent,
  effect: RevenueCatStatusEffect,
  { createIfMissing = true }: { createIfMissing?: boolean } = {}
): Promise<void> {
  if (!effect.relevant) return;

  const eventCreatedAt = new Date(event.event_timestamp_ms);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.subscription.findUnique({
      where: { userId_provider: { userId, provider: "REVENUECAT" } },
    });

    if (!existing && !createIfMissing) return;

    if (!existing) {
      // Primera compra RevenueCat de este usuario — a diferencia de Stripe
      // (cuya fila ya existe siempre, creada por createCheckoutSession
      // antes de cualquier webhook), aquí la fila nace con el propio
      // webhook. providerCustomerId = original_app_user_id, que en nuestro
      // diseño de identidad (Fase 12C, sección "Identity") ES el propio
      // User.id — coincide con userId a propósito, no es un error.
      await tx.subscription.create({
        data: {
          userId,
          provider: "REVENUECAT",
          providerCustomerId: event.original_app_user_id ?? event.app_user_id ?? userId,
          providerSubscriptionId: event.original_transaction_id ?? null,
          store: event.store ?? null,
          status: effect.status ?? "INCOMPLETE",
          cancelAtPeriodEnd: effect.cancelAtPeriodEnd ?? false,
          lastEventAt: eventCreatedAt,
        },
      });
    } else {
      // Guarda de orden atómica — mismo patrón que upsertSubscriptionFromStripe:
      // el chequeo "¿hay algo más nuevo ya aplicado?" y la escritura son la
      // MISMA sentencia (updateMany con lastEventAt en el WHERE), así un
      // evento fuera de orden nunca pisa un estado más reciente.
      const applied = await tx.subscription.updateMany({
        where: {
          id: existing.id,
          OR: [{ lastEventAt: null }, { lastEventAt: { lte: eventCreatedAt } }],
        },
        data: {
          ...(effect.status ? { status: effect.status } : {}),
          ...(effect.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: effect.cancelAtPeriodEnd } : {}),
          ...(event.store ? { store: event.store } : {}),
          providerSubscriptionId: event.original_transaction_id ?? existing.providerSubscriptionId,
          lastEventAt: eventCreatedAt,
        },
      });

      if (applied.count === 0) {
        console.warn(
          `Webhook de RevenueCat: evento descartado por llegar fuera de orden (usuario ${userId}).`
        );
        return;
      }
    }

    // hasUsedTrial es monótono y vive en User (Fase 12C) — nunca se vuelve
    // a abrir aunque el usuario ya lo hubiera usado en Stripe.
    if (effect.status === "TRIALING") {
      await tx.user.updateMany({
        where: { id: userId, hasUsedTrial: false },
        data: { hasUsedTrial: true },
      });
    }

    // User.plan ya no se deriva SOLO de esta fila — recomputeUserPlan() mira
    // TODAS las Subscription del usuario (Stripe incluida) y hace el OR.
    await recomputeUserPlan(tx, userId);
  });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!isRevenueCatConfigured() || !webhookSecret) {
    return NextResponse.json({ error: "RevenueCat no está configurado" }, { status: 503 });
  }

  const signature = req.headers.get("x-revenuecat-webhook-signature");
  const rawBody = await req.text();

  if (!verifyRevenueCatSignature(rawBody, signature, webhookSecret)) {
    console.error("Firma de webhook de RevenueCat inválida.");
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  let body: { api_version?: string; event?: RevenueCatWebhookEvent };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const event = body.event;
  if (!event?.id || !event.type || typeof event.event_timestamp_ms !== "number") {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const isTransfer = event.type === "TRANSFER";
  if (isTransfer ? !Array.isArray(event.transferred_to) : !event.app_user_id) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // Idempotencia real: mismo mecanismo ya usado para Stripe —
  // providerEventId único, insertado ANTES de procesar, para que dos
  // entregas simultáneas del mismo evento no lo apliquen dos veces. Si el
  // procesado falla, el registro se libera (ver releaseEventForRetry) para
  // que el reintento de RevenueCat lo procese de verdad en vez de tomarlo
  // por duplicado — el procesado es transaccional, así que reintentarlo es
  // seguro.
  try {
    await prisma.subscriptionEvent.create({
      data: {
        provider: "REVENUECAT",
        providerEventId: event.id,
        eventType: event.type,
        receivedAt: new Date(),
        rawPayload: body as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  try {
    if (isTransfer) {
      await applyTransfer(event);
      return NextResponse.json({ received: true });
    }

    // app_user_id DEBE resolver a un User.id real de MYS — en nuestro diseño
    // de identidad nunca es un id anónimo de RevenueCat (ver Purchases.configure
    // con appUserId=user.id). Fail-closed: si no existe, se descarta sin
    // conceder nada — pero se responde 200 para que RevenueCat no reintente
    // indefinidamente algo que nunca se va a poder resolver.
    const user = await prisma.user.findUnique({ where: { id: event.app_user_id } });
    if (!user) {
      console.error(
        `Webhook de RevenueCat: app_user_id "${event.app_user_id}" no corresponde a ningún User de MYS. Evento descartado.`
      );
      return NextResponse.json({ received: true });
    }

    const effect = mapRevenueCatEvent(event.type, event.period_type ?? null, event.cancel_reason ?? null);
    await applyWithUniqueRetry(() => applyRevenueCatEvent(user.id, event, effect));
  } catch (err) {
    console.error("Error procesando webhook de RevenueCat:", err);
    await releaseEventForRetry(event.id);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * TRANSFER no trae app_user_id: la compra pasa de las cuentas de
 * transferred_from a las de transferred_to (típicamente al restaurar
 * compras con otra cuenta). Solo se tocan ids que son User reales de MYS —
 * los anónimos de RevenueCat se ignoran, igual que en el resto de eventos.
 */
async function applyTransfer(event: RevenueCatWebhookEvent): Promise<void> {
  const [fromUsers, toUsers] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: event.transferred_from ?? [] } }, select: { id: true } }),
    prisma.user.findMany({ where: { id: { in: event.transferred_to ?? [] } }, select: { id: true } }),
  ]);

  if (fromUsers.length === 0 && toUsers.length === 0) {
    console.error("Webhook de RevenueCat: TRANSFER sin ningún User de MYS implicado. Evento descartado.");
    return;
  }

  // Origen: solo se cierra una fila que ya exista — nunca se crea una fila
  // CANCELED para alguien que no tenía nada de RevenueCat.
  for (const { id } of fromUsers) {
    await applyRevenueCatEvent(id, event, TRANSFERRED_AWAY, { createIfMissing: false });
  }

  const destinationEffect = mapRevenueCatEvent(event.type, event.period_type ?? null);
  for (const { id } of toUsers) {
    await applyWithUniqueRetry(() => applyRevenueCatEvent(id, event, destinationEffect));
  }
}

/**
 * Carrera genuina: dos eventos distintos para la primera compra de un
 * usuario intentando crear la fila REVENUECAT a la vez — el perdedor choca
 * con (userId, provider) UNIQUE. Un solo reintento basta: la fila ya
 * existe, así que la segunda vuelta toma el camino de actualización (con su
 * propia guarda de orden).
 */
async function applyWithUniqueRetry(apply: () => Promise<void>): Promise<void> {
  try {
    await apply();
  } catch (err) {
    const isUniqueClash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (!isUniqueClash) throw err;
    await apply();
  }
}

/**
 * Deshace el registro de idempotencia de un evento cuyo procesado ha
 * fallado. Sin esto, el reintento de RevenueCat chocaría con el
 * providerEventId ya insertado, se contestaría "duplicate" y el evento se
 * perdería para siempre (compra sin PRO, o cancelación que no quita PRO).
 */
async function releaseEventForRetry(providerEventId: string): Promise<void> {
  try {
    await prisma.subscriptionEvent.delete({ where: { providerEventId } });
  } catch (err) {
    console.error(
      `Webhook de RevenueCat: no se ha podido liberar el evento ${providerEventId} para reintento — revisar a mano.`,
      err
    );
  }
}
