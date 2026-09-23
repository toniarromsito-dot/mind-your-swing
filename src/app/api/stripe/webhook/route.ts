import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { billingIntervalFromPriceId, isProStatus, normalizeStripeStatus, stripe } from "@/lib/stripe";
import { canUseFeature } from "@/lib/entitlements";
import { creditVoicePurchasedSeconds, VOICE_PACK_SECONDS } from "@/lib/voice/credits";

export const runtime = "nodejs";

const VOICE_PACK_PRODUCT = "voice_pack_60min";

/**
 * Fase 11E — acredita un pack de Voice tras un pago único confirmado
 * (mode: "payment", nunca una suscripción). La idempotencia frente a un
 * reenvío de Stripe ya está resuelta ANTES de llegar aquí: providerEventId
 * es único en SubscriptionEvent y esa fila se inserta incondicionalmente
 * para CUALQUIER evento al principio de POST(), reutilizado tal cual, sin
 * ningún mecanismo nuevo.
 *
 * Verificación de integridad explícita: el customerId de la propia sesión
 * de Stripe debe resolver a la MISMA Subscription cuyo userId coincide con
 * metadata.userId. Si no coinciden, no se acredita a nadie — nunca un
 * fallback inseguro a "acreditar de todos modos".
 */
async function creditVoicePackFromCheckout(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("Webhook de Stripe: compra de pack de Voice sin metadata.userId. Pack NO acreditado.");
    return;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) {
    console.error("Webhook de Stripe: compra de pack de Voice sin customer. Pack NO acreditado.");
    return;
  }

  const subscriptionRow = await prisma.subscription.findUnique({ where: { providerCustomerId: customerId } });
  if (!subscriptionRow || subscriptionRow.userId !== userId) {
    console.error(
      `Webhook de Stripe: metadata.userId (${userId}) no coincide con el usuario del customer ${customerId} — evento de integridad. Pack NO acreditado.`
    );
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !canUseFeature(user, "VOICE_PRO")) {
    console.error(
      `Webhook de Stripe: usuario ${userId} ya no cumple Pro en el momento de acreditar el pack de Voice. Pack NO acreditado.`
    );
    return;
  }

  await creditVoicePurchasedSeconds(userId, VOICE_PACK_SECONDS);
}

/**
 * Aplica el estado de una Stripe Subscription a nuestra tabla Subscription +
 * User.plan (el resumen derivado que lee hasProAccess()). Se llama siempre
 * con el objeto Subscription completo — nunca con un delta — así que
 * procesar el mismo evento dos veces (o dos eventos distintos que acaben
 * describiendo el mismo estado) es intrínsecamente inofensivo.
 *
 * Guarda de orden ATÓMICA: el chequeo "¿hay algo más nuevo ya aplicado?" y
 * la escritura son la MISMA sentencia SQL (updateMany con `lastEventAt` en
 * el WHERE), no un read-then-write separado — así dos webhooks para el
 * mismo customer entregados de verdad en paralelo (Stripe no garantiza
 * orden de entrega) no pueden pisarse: solo puede "ganar" quien tenga el
 * `eventCreatedAt` más reciente, sin importar en qué orden llegaron las
 * peticiones HTTP.
 *
 * Se rechaza SOLO si lo ya aplicado es estrictamente más nuevo
 * (`lastEventAt > eventCreatedAt`) — un empate se APLICA, no se descarta.
 * `event.created` tiene resolución de 1 segundo, así que dos eventos reales
 * y consecutivos (p.ej. creada→activada al confirmarse el pago en el mismo
 * segundo) son indistinguibles por timestamp; descartar los empates dejaría
 * al usuario atascado en el estado del primero para siempre. La
 * contrapartida asumida: si dos eventos con el MISMO segundo se contradicen
 * de verdad (carrera genuina, no una secuencia causal normal), gana quien
 * termine de escribir en la base de datos en último lugar — no hay forma de
 * resolverlo mejor con solo resolución de segundo.
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

  const item = subscription.items.data[0];
  const status = normalizeStripeStatus(subscription.status);
  const priceId = item?.price.id ?? null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  const billingInterval = billingIntervalFromPriceId(priceId);

  await prisma.$transaction(async (tx) => {
    // hasUsedTrial es monótono (false→true, nunca al revés) y se marca
    // independientemente de si ESTE evento gana la carrera de orden de más
    // abajo: si cualquier evento, llegue en el orden que llegue, demuestra
    // que la suscripción pasó por trial, debe quedar marcado para siempre
    // — incluso si un evento más nuevo sin datos de trial "gana" después la
    // actualización de status/currentPeriodEnd.
    if (status === "TRIALING" || trialEnd) {
      await tx.subscription.updateMany({
        where: { id: existing.id, hasUsedTrial: false },
        data: { hasUsedTrial: true },
      });
    }

    const applied = await tx.subscription.updateMany({
      where: {
        id: existing.id,
        OR: [{ lastEventAt: null }, { lastEventAt: { lte: eventCreatedAt } }],
      },
      data: {
        providerSubscriptionId: subscription.id,
        status,
        billingInterval: billingInterval ?? undefined,
        priceId: priceId ?? undefined,
        currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd,
        lastEventAt: eventCreatedAt,
      },
    });

    if (applied.count === 0) {
      // O bien fuera de orden, o perdió la carrera contra una escritura
      // concurrente más nueva para el mismo customer — en ambos casos no se
      // toca User.plan: lo que sea que haya ganado ya lo habrá sincronizado.
      console.warn(
        `Webhook de Stripe: evento descartado por llegar fuera de orden (customer ${customerId}).`
      );
      return;
    }

    await tx.user.update({
      where: { id: existing.userId },
      data: { plan: isProStatus(status) ? "PRO" : "FREE" },
    });
  });
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
        } else if (session.mode === "payment" && session.metadata?.product === VOICE_PACK_PRODUCT) {
          await creditVoicePackFromCheckout(session);
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
