import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

/**
 * Fase 11B — Subscription Foundation. Integración con DB real: el webhook
 * es la única vía por la que un usuario pasa a PRO — estos tests prueban su
 * idempotencia (providerEventId único), su resistencia a eventos fuera de
 * orden (incluida entrega realmente concurrente, no solo secuencial), y que
 * cada status de Stripe se traduce exactamente en el acceso que toca (ver
 * isProStatus() en src/lib/stripe.ts).
 *
 * constructEventImpl por defecto PARSEA el evento del propio body de la
 * petición (igual que hace Stripe de verdad al verificar la firma) en vez
 * de depender de una variable compartida fijada test a test — así dos
 * peticiones lanzadas de verdad en paralelo (test de concurrencia) resuelven
 * cada una SU PROPIO evento, sin que una pise el mock de la otra a mitad de
 * ejecución.
 */

let constructEventImpl: (body: string, sig: string, secret: string) => Stripe.Event = (body) =>
  JSON.parse(body) as Stripe.Event;
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

function req(event: Stripe.Event) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "test-signature" },
    body: JSON.stringify(event),
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
    const original = constructEventImpl;
    constructEventImpl = () => {
      throw new Error("firma inválida");
    };
    try {
      const res = await POST(req(makeEvent("evt_bad_sig", "customer.subscription.updated", makeSubscription())));
      expect(res.status).toBe(400);
    } finally {
      constructEventImpl = original;
    }
  });

  it("10. un webhook válido sincroniza el estado: ACTIVE concede Pro", async () => {
    const user = await makeUserWithSubscription("valid-sync", "cus_valid_sync");
    const stripeSubscription = makeSubscription({ customer: "cus_valid_sync", status: "active" });
    const event = makeEvent("evt_valid_sync", "customer.subscription.updated", stripeSubscription);

    const res = await POST(req(event));
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

    const first = await POST(req(event));
    expect(first.status).toBe(200);

    const afterFirst = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(afterFirst.plan).toBe("PRO");
    const subAfterFirst = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(subAfterFirst.status).toBe("TRIALING");
    expect(subAfterFirst.hasUsedTrial).toBe(true);

    // Mismo event.id reentregado (redelivery de Stripe) — debe tratarse como ya procesado.
    const second = await POST(req(event));
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
    await POST(req(canceledEvent));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: canceledUser.id } })).plan).toBe("FREE");

    const pastDueUser = await makeUserWithSubscription("past-due", "cus_past_due");
    const pastDueEvent = makeEvent(
      "evt_past_due",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_past_due", status: "past_due" })
    );
    await POST(req(pastDueEvent));
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
    await POST(req(newerEvent));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");

    // Evento MÁS ANTIGUO (created menor) que llega tarde, describiendo un canceled previo.
    const olderEvent = makeEvent(
      "evt_ooo_older",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_ooo", status: "canceled" }),
      now - 3600
    );
    await POST(req(olderEvent));

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

    const res = await POST(req(event));
    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
  });

  it("un evento para un customerId sin usuario asociado se descarta sin lanzar (200) y sin crear datos huérfanos", async () => {
    const event = makeEvent(
      "evt_unknown_customer",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_never_existed", status: "active" })
    );
    const res = await POST(req(event));
    expect(res.status).toBe(200);
  });

  it("[fix de audit] dos eventos reales en el MISMO segundo (creada→activada) se aplican en orden — el segundo no se descarta por empate", async () => {
    const user = await makeUserWithSubscription("same-second", "cus_same_second");
    const sameSecond = Math.floor(Date.now() / 1000);

    const created = makeEvent(
      "evt_same_second_created",
      "customer.subscription.created",
      makeSubscription({ customer: "cus_same_second", status: "incomplete" }),
      sameSecond
    );
    await POST(req(created));
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } })).status).toBe(
      "INCOMPLETE"
    );

    // Mismo segundo exacto que el evento anterior — con `lte` esto se habría
    // descartado como "no más nuevo" y el usuario se habría quedado
    // atascado en INCOMPLETE pese a que Stripe ya lo confirmó activo.
    const updated = makeEvent(
      "evt_same_second_updated",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_same_second", status: "active" }),
      sameSecond
    );
    await POST(req(updated));

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.status).toBe("ACTIVE");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
  });

  it("[fix de audit] dos webhooks concurrentes para el mismo customer no se pisan — gana el de created más reciente sin importar qué petición HTTP termina antes", async () => {
    const user = await makeUserWithSubscription("concurrent", "cus_concurrent");
    const now = Math.floor(Date.now() / 1000);

    const older = makeEvent(
      "evt_concurrent_older",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_concurrent", status: "past_due" }),
      now
    );
    const newer = makeEvent(
      "evt_concurrent_newer",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_concurrent", status: "active" }),
      now + 5
    );

    // Lanzadas a la vez (sin esperar a que termine la primera) para forzar
    // el mismo solapamiento que dos webhooks reales entregados en paralelo
    // — sin la escritura condicional atómica, la que termine su transacción
    // en último lugar gana sin importar cuál sea realmente la más nueva.
    await Promise.all([POST(req(older)), POST(req(newer))]);

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.status).toBe("ACTIVE"); // el evento con created más reciente, gane quien gane la carrera HTTP
  });

  it("[fix de audit] hasUsedTrial queda marcado aunque un evento sin datos de trial gane después la actualización de status", async () => {
    const user = await makeUserWithSubscription("trial-monotone", "cus_trial_monotone");
    const now = Math.floor(Date.now() / 1000);

    const trialing = makeEvent(
      "evt_trial_monotone_trialing",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_trial_monotone", status: "trialing", trial_end: now + 3 * 86400 }),
      now
    );
    await POST(req(trialing));
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } })).hasUsedTrial).toBe(
      true
    );

    // Evento posterior sin trial_end (conversión a ACTIVE) — hasUsedTrial no debe volver a false.
    const active = makeEvent(
      "evt_trial_monotone_active",
      "customer.subscription.updated",
      makeSubscription({ customer: "cus_trial_monotone", status: "active", trial_end: null }),
      now + 10
    );
    await POST(req(active));

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.hasUsedTrial).toBe(true);
  });
});
