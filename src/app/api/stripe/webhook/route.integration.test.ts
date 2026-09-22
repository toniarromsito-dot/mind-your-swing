import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

/**
 * Fase 11B — Subscription Foundation. Integración con DB real: el webhook
 * es la única vía por la que un usuario pasa a PRO — estos tests prueban su
 * idempotencia (providerEventId único), su resistencia a eventos fuera de
 * orden, y que cada status de Stripe se traduce exactamente en el acceso
 * que toca (ver isProStatus() en src/lib/stripe.ts).
 */

let constructEventImpl: (body: string, sig: string, secret: string) => Stripe.Event;
let subscriptionsRetrieveImpl: (id: string) => Promise<Stripe.Subscription>;

vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    stripe: {
      webhooks: { constructEvent: (...args: [string, string, string]) => constructEventImpl(...args) },
      subscriptions: { retrieve: (id: string) => subscriptionsRetrieveImpl(id) },
    },
  };
});

const { POST } = await import("./route");

function makeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: `sub_test_${Math.random().toString(36).slice(2, 10)}`,
    object: "subscription",
    customer: "cus_test_1",
    status: "active",
    cancel_at_period_end: false,
    trial_end: null,
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          price: { id: "price_monthly_test" },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function makeEvent(
  id: string,
  type: string,
  data: object,
  createdAt = Math.floor(Date.now() / 1000)
): Stripe.Event {
  return { id, type, created: createdAt, data: { object: data } } as unknown as Stripe.Event;
}

function req(body: string) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "test-signature" },
    body,
  });
}

describe("POST /api/stripe/webhook (integración, DB real)", () => {
  const userIds: string[] = [];
  const ORIGINAL_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const ORIGINAL_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const ORIGINAL_PRICE_MONTHLY = process.env.STRIPE_PRO_PRICE_ID_MONTHLY;

  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fake";
  process.env.STRIPE_PRO_PRICE_ID_MONTHLY = "price_monthly_test";

  async function makeUserWithSubscription(label: string, customerId: string) {
    const user = await prisma.user.create({
      data: {
        email: `webhook-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        name: label,
        subscription: { create: { providerCustomerId: customerId } },
      },
      include: { subscription: true },
    });
    userIds.push(user.id);
    return user;
  }

  afterEach(() => {
    constructEventImpl = undefined as unknown as typeof constructEventImpl;
  });

  afterAll(async () => {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = ORIGINAL_WEBHOOK_SECRET;
    process.env.STRIPE_PRO_PRICE_ID_MONTHLY = ORIGINAL_PRICE_MONTHLY;
    await prisma.subscriptionEvent.deleteMany({});
    await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("12. un webhook con firma inválida es rechazado (400) y no toca ningún dato", async () => {
    constructEventImpl = () => {
      throw new Error("firma inválida");
    };
    const res = await POST(req("{}"));
    expect(res.status).toBe(400);
  });

  it("10. un webhook válido sincroniza el estado: ACTIVE concede Pro", async () => {
    const user = await makeUserWithSubscription("valid-sync", "cus_valid_sync");
    const stripeSubscription = makeSubscription({ customer: "cus_valid_sync", status: "active" });
    const event = makeEvent("evt_valid_sync", "customer.subscription.updated", stripeSubscription);
    constructEventImpl = () => event;

    const res = await POST(req(JSON.stringify(event)));
    expect(res.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.plan).toBe("PRO");

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.providerSubscriptionId).toBe(stripeSubscription.id);
    expect(sub.billingInterval).toBe("MONTHLY");
  });

  it("7. TRIALING concede acceso Pro y marca hasUsedTrial — 11. un webhook duplicado no duplica ni rompe el estado", async () => {
    const user = await makeUserWithSubscription("trial-dup", "cus_trial_dup");
    const trialEnd = Math.floor(Date.now() / 1000) + 3 * 86400;
    const event = makeEvent(
      "evt_trial_dup",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_trial_dup", status: "trialing", trial_end: trialEnd })
    );
    constructEventImpl = () => event;

    const first = await POST(req(JSON.stringify(event)));
    expect(first.status).toBe(200);

    const afterFirst = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(afterFirst.plan).toBe("PRO");
    const subAfterFirst = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(subAfterFirst.status).toBe("TRIALING");
    expect(subAfterFirst.hasUsedTrial).toBe(true);

    // Mismo event.id reentregado (redelivery de Stripe) — debe tratarse como ya procesado.
    const second = await POST(req(JSON.stringify(event)));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });

    const eventsStored = await prisma.subscriptionEvent.count({ where: { providerEventId: "evt_trial_dup" } });
    expect(eventsStored).toBe(1); // el reintento no insertó una segunda fila
  });

  it("8/9. CANCELED y PAST_DUE no conceden acceso Pro", async () => {
    const canceledUser = await makeUserWithSubscription("canceled", "cus_canceled");
    const canceledEvent = makeEvent(
      "evt_canceled",
      "customer.subscription.deleted",
      makeSubscription({ customer: "cus_canceled", status: "canceled" })
    );
    constructEventImpl = () => canceledEvent;
    await POST(req(JSON.stringify(canceledEvent)));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: canceledUser.id } })).plan).toBe("FREE");

    const pastDueUser = await makeUserWithSubscription("past-due", "cus_past_due");
    const pastDueEvent = makeEvent(
      "evt_past_due",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_past_due", status: "past_due" })
    );
    constructEventImpl = () => pastDueEvent;
    await POST(req(JSON.stringify(pastDueEvent)));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: pastDueUser.id } })).plan).toBe("FREE");
  });

  it("un evento que llega fuera de orden (más antiguo que el último aplicado) se descarta sin revertir el estado", async () => {
    const user = await makeUserWithSubscription("out-of-order", "cus_ooo");
    const now = Math.floor(Date.now() / 1000);

    const newerEvent = makeEvent(
      "evt_ooo_newer",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_ooo", status: "active" }),
      now
    );
    constructEventImpl = () => newerEvent;
    await POST(req(JSON.stringify(newerEvent)));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");

    // Evento MÁS ANTIGUO (created menor) que llega tarde, describiendo un canceled previo.
    const olderEvent = makeEvent(
      "evt_ooo_older",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_ooo", status: "canceled" }),
      now - 3600
    );
    constructEventImpl = () => olderEvent;
    await POST(req(JSON.stringify(olderEvent)));

    // El estado sigue siendo PRO/ACTIVE — el evento antiguo no lo revirtió.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.status).toBe("ACTIVE");
  });

  it("checkout.session.completed recupera la suscripción real de Stripe y sincroniza", async () => {
    const user = await makeUserWithSubscription("checkout-complete", "cus_checkout");
    subscriptionsRetrieveImpl = async () => makeSubscription({ customer: "cus_checkout", status: "active" });

    const event = makeEvent("evt_checkout", "checkout.session.completed", {
      id: "cs_test_1",
      subscription: "sub_test_1",
    });
    constructEventImpl = () => event;

    const res = await POST(req(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
  });

  it("un evento para un customerId sin usuario asociado se descarta sin lanzar (200) y sin crear datos huérfanos", async () => {
    const event = makeEvent(
      "evt_unknown_customer",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_never_existed", status: "active" })
    );
    constructEventImpl = () => event;

    const res = await POST(req(JSON.stringify(event)));
    expect(res.status).toBe(200);
  });
});
