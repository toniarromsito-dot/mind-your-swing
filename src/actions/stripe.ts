"use server";

import { redirect } from "next/navigation";
import { Prisma, type BillingInterval } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProStatus, isStripeConfigured, isVoicePackConfigured, proPriceId, stripe, voicePackPriceId } from "@/lib/stripe";
import { canUseFeature } from "@/lib/entitlements";
import { checkRateLimit } from "@/lib/rate-limit";

// Hardening sección 42/43 — createVoicePackCheckoutSession no tenía ningún
// límite: sin esto, un cliente hostil (o un doble-tap/doble-envío
// automatizado) podía crear Checkout Sessions sin fin. No bloquea comprar
// dos packs legítimos (la ventana/cuota es generosa a propósito, mismo
// criterio que CREATE_GAME_RATE_LIMIT/FINISH_GAME_RATE_LIMIT).
const VOICE_PACK_CHECKOUT_RATE_LIMIT = { windowMs: 10 * 60_000, maxRequests: 5 };

async function getOrCreateStripeCustomerId(userId: string, email: string, name: string | null) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { subscriptions: true },
  });
  // Fase 12C: un usuario puede tener también una Subscription(REVENUECAT) —
  // aquí solo nos interesa su fila de Stripe, si existe.
  const stripeSub = user.subscriptions.find((s) => s.provider === "STRIPE");
  if (stripeSub) return stripeSub.providerCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  });

  // La fila Subscription se crea aquí, ANTES de cualquier checkout — así el
  // webhook siempre encuentra a qué usuario pertenece un customerId, incluso
  // para el primer evento que llegue (checkout.session.completed puede
  // adelantarse a la respuesta de este Server Action). provider=STRIPE por
  // el @default() del schema — no hace falta pasarlo explícitamente.
  try {
    await prisma.subscription.create({
      data: { userId, providerCustomerId: customer.id },
    });
  } catch (err) {
    // Doble tap/doble envío del mismo formulario (plausible en móvil): dos
    // llamadas concurrentes de este mismo usuario pueden pasar ambas el
    // `find` de arriba antes de que ninguna haya insertado todavía —
    // (userId, provider) es UNIQUE en Subscription (Fase 12C: antes era
    // userId a secas), así que la segunda pierde la carrera con un P2002.
    // En vez de romper con un 500, se usa la fila que la otra petición ya
    // creó. El customer de Stripe que este intento perdedor acaba de crear
    // queda huérfano en Stripe (sin suscripción nunca asociada) —
    // inofensivo, no se factura nada.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const won = await prisma.subscription.findUniqueOrThrow({
        where: { userId_provider: { userId, provider: "STRIPE" } },
      });
      return won.providerCustomerId;
    }
    throw err;
  }

  return customer.id;
}

export async function createCheckoutSession(interval: BillingInterval) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isStripeConfigured()) throw new Error("Los pagos no están configurados todavía.");
  if (interval !== "MONTHLY" && interval !== "ANNUAL") {
    throw new Error("Intervalo de facturación no válido.");
  }

  const priceId = proPriceId(interval);
  if (!priceId) throw new Error("Los pagos no están configurados todavía.");

  // Servidor, no el cliente, decide si esta cuenta puede abrir un checkout
  // nuevo: si ya tiene acceso Pro (activo o en trial) por CUALQUIER
  // provider — Stripe o RevenueCat (Fase 12C) —, no se crea una segunda
  // suscripción. Evita un doble cobro si el formulario se envía dos veces
  // (dos pestañas, un back del navegador) y evita también comprar en web
  // teniendo ya PRO por App Store/Google Play.
  const existingSubs = await prisma.subscription.findMany({ where: { userId: session.user.id } });
  if (existingSubs.some((s) => isProStatus(s.status))) {
    throw new Error("Ya tienes una suscripción Pro activa.");
  }

  const customerId = await getOrCreateStripeCustomerId(
    session.user.id,
    session.user.email!,
    session.user.name ?? null
  );

  // Fase 12C: hasUsedTrial vive en User (es del usuario, no de la fila de
  // un provider concreto) — así usarlo ya en RevenueCat no lo reabre aquí.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/settings?checkout=success`,
    cancel_url: `${baseUrl}/settings?checkout=cancel`,
    client_reference_id: session.user.id,
    // Trial de 3 días — solo si este usuario (esta cuenta, ligada a su
    // identidad, no a su sesión/dispositivo/provider) nunca lo ha usado.
    // Una vez concedido queda marcado para siempre (ver webhook), así que
    // cerrar sesión, cambiar de dispositivo, de plataforma o crear otro
    // checkout no lo reinicia.
    subscription_data: user.hasUsedTrial ? undefined : { trial_period_days: 3 },
  });

  if (checkoutSession.url) redirect(checkoutSession.url);
}

/**
 * Fase 11E — pack de Voice: 60 min por 6,99 €, compra ÚNICA (mode:
 * "payment"), nunca una suscripción. A diferencia de createCheckoutSession,
 * NO bloquea una segunda compra si el usuario ya tiene un pack — comprar
 * dos packs legítimamente es válido (ver spec: "si realmente paga dos
 * packs, debe recibir dos packs"), lo único que no puede pasar es que UN
 * pago se acredite dos veces (eso lo cierra la idempotencia del webhook,
 * no esto).
 */
export async function createVoicePackCheckoutSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isVoicePackConfigured()) throw new Error("Los packs de Voice no están configurados todavía.");

  const rl = checkRateLimit(`voice-pack-checkout:${session.user.id}`, VOICE_PACK_CHECKOUT_RATE_LIMIT);
  if (!rl.allowed) {
    throw new Error("Estás creando compras demasiado rápido. Espera unos minutos e inténtalo de nuevo.");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!canUseFeature(user, "VOICE_PRO")) {
    throw new Error("Los packs de Voice requieren el plan Pro.");
  }

  // Reutiliza el customer YA existente (creado al suscribirse) — un pack
  // nunca crea un customer de Stripe nuevo. Si todavía no existe ninguna
  // Subscription DE STRIPE (nunca ha pasado por checkout de Pro en web —
  // puede que sea Pro solo vía RevenueCat/móvil, Fase 12C), no hay customer
  // de Stripe al que asociar el pack — no se improvisa uno. El pack de Voice
  // siempre se cobra vía Stripe, nunca vía RevenueCat.
  const subscriptionRow = await prisma.subscription.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: "STRIPE" } },
  });
  if (!subscriptionRow) throw new Error("No tienes ninguna suscripción todavía.");

  const priceId = voicePackPriceId();
  if (!priceId) throw new Error("Los packs de Voice no están configurados todavía.");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: subscriptionRow.providerCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings?voicePack=success`,
    cancel_url: `${baseUrl}/settings?voicePack=cancel`,
    // Identificación inequívoca para el webhook — nunca se infiere solo de
    // la ausencia de session.subscription (session.mode ya lo distingue,
    // pero metadata.product deja explícito de qué producto se trata si en
    // el futuro hay más de un tipo de compra one-time).
    metadata: { userId: session.user.id, product: "voice_pack_60min" },
  });

  if (checkoutSession.url) redirect(checkoutSession.url);
}

export async function createPortalSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isStripeConfigured()) throw new Error("Los pagos no están configurados todavía.");

  // El Portal de facturación es exclusivamente de Stripe — un usuario que
  // solo sea Pro vía RevenueCat (Fase 12C) no tiene nada que gestionar aquí.
  const subscriptionRow = await prisma.subscription.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: "STRIPE" } },
  });
  if (!subscriptionRow) throw new Error("No tienes ninguna suscripción todavía.");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscriptionRow.providerCustomerId,
    return_url: `${baseUrl}/settings`,
  });

  redirect(portalSession.url);
}
