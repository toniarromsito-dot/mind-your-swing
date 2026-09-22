import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { billingIntervalFromPriceId, isProStatus, normalizeStripeStatus, stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Aplica el estado de una Stripe Subscription a nuestra tabla Subscription +
 * User.plan (el resumen derivado que lee hasProAccess()). Se llama siempre
 * con el objeto Subscription completo — nunca con un delta — así que
 * procesar el mismo evento dos veces (o dos eventos distintos que acaben
 * describiendo el mismo estado) es intrínsecamente inofensivo.
 *
 * Guarda de orden: si ya aplicamos un evento más reciente que este
 * (`eventCreatedAt <= lastEventAt`), no se sobrescribe — evita que una
 * entrega tardía de un evento antiguo revierta un estado más nuevo.
 */
async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription, eventCreatedAt: Date) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const existing = await prisma.subscription.findUnique({
    where: { providerCustomerId: customerId },
  });

  if (!existing) {
    // No hay ningún usuario nuestro con este customerId — no podemos
    // atribuir el evento a nadie. En condiciones normales no debería
    // ocurrir: la fila Subscription se crea (INCOMPLETE, sin
    // providerSubscriptionId) en el momento en que creamos el customer de
    // Stripe, antes de cualquier checkout. Se registra y se descarta.
    console.error(`Webhook de Stripe: no existe Subscription para customer ${customerId}. Evento descartado.`);
    return;
  }

  if (existing.lastEventAt && eventCreatedAt.getTime() <= existing.lastEventAt.getTime()) {
    console.warn(
      `Webhook de Stripe: evento descartado por llegar fuera de orden (customer ${customerId}).`
    );
    return;
  }

  const item = subscription.items.data[0];
  const status = normalizeStripeStatus(subscription.status);
  const priceId = item?.price.id ?? null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: existing.id },
      data: {
        providerSubscriptionId: subscription.id,
        status,
        billingInterval: billingIntervalFromPriceId(priceId) ?? existing.billingInterval,
        priceId: priceId ?? existing.priceId,
        currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd,
        // Monotono: una vez true, nunca vuelve a false. Empieza el trial en
        // cuanto vemos TRIALING o un trial_end, sin importar en qué estado
        // esté la suscripción ahora (p.ej. ya haya pasado a ACTIVE).
        hasUsedTrial: existing.hasUsedTrial || status === "TRIALING" || Boolean(trialEnd),
        lastEventAt: eventCreatedAt,
      },
    }),
    prisma.user.update({
      where: { id: existing.userId },
      data: { plan: isProStatus(status) ? "PRO" : "FREE" },
    }),
  ]);
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe no está configurado" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", webhookSecret);
  } catch (err) {
    console.error("Firma de webhook de Stripe inválida:", err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  // Idempotencia real: providerEventId es UNIQUE. Si Stripe reentrega el
  // mismo evento (su propia política de reintentos, o una redelivery
  // manual), este insert falla con P2002 y el evento se trata como ya
  // procesado sin volver a tocar Subscription/User. Se hace ANTES de
  // procesar nada, no después, para que un fallo a mitad de proceso no dé
  // lugar a un reintento que sí duplique efectos.
  try {
    await prisma.subscriptionEvent.create({
      data: {
        provider: "STRIPE",
        providerEventId: event.id,
        eventType: event.type,
        receivedAt: new Date(),
        rawPayload: event as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  const eventCreatedAt = new Date(event.created * 1000);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(subscription, eventCreatedAt);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription, eventCreatedAt);
        break;
      }
      case "invoice.payment_failed": {
        // El estado PAST_DUE llega igualmente vía customer.subscription.updated
        // (Stripe transiciona el status de la suscripción al fallar el
        // cobro), así que no hace falta actuar aquí para el entitlement.
        // Se deja registrado en SubscriptionEvent (ya insertado arriba) como
        // rastro de auditoría para una futura fase de dunning/notificaciones.
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Error procesando webhook de Stripe:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
