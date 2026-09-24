import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRevenueCatConfigured, mapRevenueCatEvent, verifyRevenueCatSignature } from "@/lib/revenuecat";
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
  app_user_id: string;
  original_app_user_id?: string;
  original_transaction_id?: string;
  store?: string;
  period_type?: string;
  event_timestamp_ms: number;
};

async function applyRevenueCatEvent(userId: string, event: RevenueCatWebhookEvent): Promise<void> {
  const effect = mapRevenueCatEvent(event.type, event.period_type ?? null);
  if (!effect.relevant) return;

  const eventCreatedAt = new Date(event.event_timestamp_ms);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.subscription.findUnique({
      where: { userId_provider: { userId, provider: "REVENUECAT" } },
    });

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
          providerCustomerId: event.original_app_user_id ?? event.app_user_id,
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
  if (!event?.id || !event.type || !event.app_user_id || typeof event.event_timestamp_ms !== "number") {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // Idempotencia real: mismo mecanismo ya usado para Stripe —
  // providerEventId único, insertado ANTES de procesar nada, para que un
  // fallo a mitad de proceso no dé lugar a un reintento que sí duplique
  // efectos.
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

  try {
    try {
      await applyRevenueCatEvent(user.id, event);
    } catch (err) {
      // Carrera genuina: dos eventos distintos para la primera compra de
      // este usuario intentando crear la fila REVENUECAT a la vez — el
      // perdedor choca con (userId, provider) UNIQUE. Un solo reintento
      // basta: la fila ya existe, así que la segunda vuelta toma el camino
      // de actualización (con su propia guarda de orden).
      const isUniqueClash =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!isUniqueClash) throw err;
      await applyRevenueCatEvent(user.id, event);
    }
  } catch (err) {
    console.error("Error procesando webhook de RevenueCat:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
