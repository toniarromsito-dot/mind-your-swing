"use server";

import { redirect } from "next/navigation";
import { Prisma, type BillingInterval } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProStatus, isStripeConfigured, proPriceId, stripe } from "@/lib/stripe";

async function getOrCreateStripeCustomerId(userId: string, email: string, name: string | null) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { subscription: true },
  });
  if (user.subscription) return user.subscription.providerCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  });

  // La fila Subscription se crea aquí, ANTES de cualquier checkout — así el
  // webhook siempre encuentra a qué usuario pertenece un customerId, incluso
  // para el primer evento que llegue (checkout.session.completed puede
  // adelantarse a la respuesta de este Server Action).
  try {
    await prisma.subscription.create({
      data: { userId, providerCustomerId: customer.id },
    });
  } catch (err) {
    // Doble tap/doble envío del mismo formulario (plausible en móvil): dos
    // llamadas concurrentes de este mismo usuario pueden pasar ambas el
    // `if (user.subscription)` de arriba antes de que ninguna haya
    // insertado todavía — userId es UNIQUE en Subscription, así que la
    // segunda pierde la carrera con un P2002. En vez de romper con un 500,
    // se usa la fila que la otra petición ya creó. El customer de Stripe
    // que este intento perdedor acaba de crear queda huérfano en Stripe
    // (sin suscripción nunca asociada) — inofensivo, no se factura nada.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const won = await prisma.subscription.findUniqueOrThrow({ where: { userId } });
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
  // nuevo: si ya tiene una suscripción con acceso Pro (activa o en trial),
  // no se crea una segunda — evita un doble cobro si el formulario se envía
  // dos veces (dos pestañas, un back del navegador tras suscribirse) en vez
  // de confiar en que la UI ya oculta este botón para un usuario Pro.
  const before = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  if (before && isProStatus(before.status)) {
    throw new Error("Ya tienes una suscripción Pro activa.");
  }

  const customerId = await getOrCreateStripeCustomerId(
    session.user.id,
    session.user.email!,
    session.user.name ?? null
  );

  const subscriptionRow = await prisma.subscription.findUniqueOrThrow({
    where: { userId: session.user.id },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/settings?checkout=success`,
    cancel_url: `${baseUrl}/settings?checkout=cancel`,
    client_reference_id: session.user.id,
    // Trial de 3 días — solo si este usuario (esta Subscription, ligada a su
    // identidad, no a su sesión/dispositivo) nunca lo ha usado. Una vez
    // concedido queda marcado para siempre en la fila (ver webhook), así que
    // cerrar sesión, cambiar de dispositivo o crear otro checkout no lo
    // reinicia.
    subscription_data: subscriptionRow.hasUsedTrial ? undefined : { trial_period_days: 3 },
  });

  if (checkoutSession.url) redirect(checkoutSession.url);
}

export async function createPortalSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isStripeConfigured()) throw new Error("Los pagos no están configurados todavía.");

  const subscriptionRow = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });
  if (!subscriptionRow) throw new Error("No tienes ninguna suscripción todavía.");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscriptionRow.providerCustomerId,
    return_url: `${baseUrl}/settings`,
  });

  redirect(portalSession.url);
}
