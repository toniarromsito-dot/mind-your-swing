"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured, PRO_PRICE_ID, stripe } from "@/lib/stripe";

async function getOrCreateStripeCustomerId(userId: string, email: string, name: string | null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isStripeConfigured()) throw new Error("Los pagos no están configurados todavía.");

  const customerId = await getOrCreateStripeCustomerId(
    session.user.id,
    session.user.email!,
    session.user.name ?? null
  );

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
    success_url: `${baseUrl}/perfil?checkout=success`,
    cancel_url: `${baseUrl}/perfil?checkout=cancel`,
    client_reference_id: session.user.id,
  });

  if (checkoutSession.url) redirect(checkoutSession.url);
}

export async function createPortalSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  if (!isStripeConfigured()) throw new Error("Los pagos no están configurados todavía.");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!user.stripeCustomerId) throw new Error("No tienes ninguna suscripción todavía.");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/perfil`,
  });

  redirect(portalSession.url);
}
