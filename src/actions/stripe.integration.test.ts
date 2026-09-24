import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Fase 11B — Subscription Foundation. Integración con DB real: createCheckoutSession
 * y createPortalSession nunca deben poder conceder Pro por sí mismos (eso es
 * exclusivo del webhook, ver route.integration.test.ts) ni operar sobre la
 * suscripción de otro usuario — la identidad siempre sale de auth(), nunca
 * de un parámetro que pudiera venir manipulado desde el cliente.
 */

let sessionUserId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (sessionUserId ? { user: { id: sessionUserId, email: "x@example.com", name: "X" } } : null)) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", url });
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma tipada para poder inspeccionar *.mock.calls
const customersCreate = vi.fn(async (_opts: unknown) => ({ id: `cus_${Math.random().toString(36).slice(2, 10)}` }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma tipada para poder inspeccionar *.mock.calls
const checkoutSessionsCreate = vi.fn(async (_opts: unknown) => ({ url: "https://checkout.stripe.com/test" }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma tipada para poder inspeccionar *.mock.calls
const portalSessionsCreate = vi.fn(async (_opts: unknown) => ({ url: "https://billing.stripe.com/test" }));

vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    stripe: {
      customers: { create: customersCreate },
      checkout: { sessions: { create: checkoutSessionsCreate } },
      billingPortal: { sessions: { create: portalSessionsCreate } },
    },
  };
});

const { createCheckoutSession, createPortalSession } = await import("@/actions/stripe");

async function runIgnoringRedirect(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as { digest?: string })?.digest !== "NEXT_REDIRECT") throw e;
  }
}

describe("createCheckoutSession / createPortalSession (integración, DB real)", () => {
  const userIds: string[] = [];
  const ORIGINAL_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const ORIGINAL_PRICE_MONTHLY = process.env.STRIPE_PRO_PRICE_ID_MONTHLY;
  const ORIGINAL_PRICE_ANNUAL = process.env.STRIPE_PRO_PRICE_ID_ANNUAL;

  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_PRO_PRICE_ID_MONTHLY = "price_monthly_test";
  process.env.STRIPE_PRO_PRICE_ID_ANNUAL = "price_annual_test";

  async function makeUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `stripe-action-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, name: label },
    });
    userIds.push(user.id);
    return user;
  }

  beforeEach(() => {
    customersCreate.mockClear();
    checkoutSessionsCreate.mockClear();
    portalSessionsCreate.mockClear();
  });

  afterEach(() => {
    sessionUserId = "";
  });

  afterAll(async () => {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET_KEY;
    process.env.STRIPE_PRO_PRICE_ID_MONTHLY = ORIGINAL_PRICE_MONTHLY;
    process.env.STRIPE_PRO_PRICE_ID_ANNUAL = ORIGINAL_PRICE_ANNUAL;
    await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("13. crear una sesión de checkout nunca concede Pro por sí mismo — el plan sigue FREE hasta que llegue el webhook", async () => {
    const user = await makeUser("no-self-grant");
    sessionUserId = user.id;

    await runIgnoringRedirect(() => createCheckoutSession("MONTHLY"));

    const afterCheckout = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(afterCheckout.plan).toBe("FREE");
  });

  it("crea la fila Subscription (con providerCustomerId) antes de iniciar el checkout", async () => {
    const user = await makeUser("creates-subscription-row");
    sessionUserId = user.id;

    await runIgnoringRedirect(() => createCheckoutSession("MONTHLY"));

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "STRIPE" } },
    });
    expect(sub.providerCustomerId).toMatch(/^cus_/);
    expect(sub.status).toBe("INCOMPLETE");
  });

  it("el primer checkout de un usuario incluye el trial de 3 días; el siguiente, una vez usado, no lo repite", async () => {
    const user = await makeUser("trial-once");
    sessionUserId = user.id;

    await runIgnoringRedirect(() => createCheckoutSession("MONTHLY"));
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_data: { trial_period_days: 3 } })
    );

    // Simula que el webhook ya marcó el trial como usado (p.ej. tras pasar por
    // TRIALING) — Fase 12C: hasUsedTrial vive en User, no en Subscription.
    await prisma.user.update({ where: { id: user.id }, data: { hasUsedTrial: true } });

    await runIgnoringRedirect(() => createCheckoutSession("ANNUAL"));
    const lastCall = checkoutSessionsCreate.mock.calls.at(-1)![0] as { subscription_data?: unknown };
    expect(lastCall.subscription_data).toBeUndefined();
  });

  it("usa el Price ID correcto según el intervalo elegido (mensual vs anual) sin hardcodear precios", async () => {
    const user = await makeUser("interval-price");
    sessionUserId = user.id;

    await runIgnoringRedirect(() => createCheckoutSession("ANNUAL"));
    const call = checkoutSessionsCreate.mock.calls.at(-1)![0] as { line_items: { price: string }[] };
    expect(call.line_items[0].price).toBe("price_annual_test");
  });

  it("15. la identidad del customer siempre sale de la sesión autenticada, nunca de un parámetro externo — dos usuarios nunca comparten ni chocan su Subscription", async () => {
    const userA = await makeUser("idor-a");
    const userB = await makeUser("idor-b");

    sessionUserId = userA.id;
    await runIgnoringRedirect(() => createCheckoutSession("MONTHLY"));

    sessionUserId = userB.id;
    await runIgnoringRedirect(() => createCheckoutSession("MONTHLY"));

    const subA = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: userA.id, provider: "STRIPE" } },
    });
    const subB = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: userB.id, provider: "STRIPE" } },
    });
    expect(subA.providerCustomerId).not.toBe(subB.providerCustomerId);

    // B intenta gestionar su portal — el customerId usado es el suyo, nunca el de A.
    sessionUserId = userB.id;
    await runIgnoringRedirect(() => createPortalSession());
    const portalCall = portalSessionsCreate.mock.calls.at(-1)![0] as { customer: string };
    expect(portalCall.customer).toBe(subB.providerCustomerId);
    expect(portalCall.customer).not.toBe(subA.providerCustomerId);
  });

  it("createPortalSession sin sesión activa redirige a / en vez de operar sobre cualquier cuenta", async () => {
    sessionUserId = "";
    await expect(createPortalSession()).rejects.toMatchObject({ digest: "NEXT_REDIRECT", url: "/" });
    expect(portalSessionsCreate).not.toHaveBeenCalled();
  });

  it("[fix de audit] un usuario que ya tiene Pro activo (ACTIVE) no puede abrir un segundo checkout", async () => {
    const user = await makeUser("already-active");
    await prisma.subscription.create({
      data: { userId: user.id, providerCustomerId: "cus_already_active", status: "ACTIVE" },
    });
    sessionUserId = user.id;

    await expect(createCheckoutSession("MONTHLY")).rejects.toThrow(/ya tienes/i);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("[fix de audit] un usuario en trial (TRIALING) tampoco puede abrir un segundo checkout", async () => {
    const user = await makeUser("already-trialing");
    await prisma.subscription.create({
      data: { userId: user.id, providerCustomerId: "cus_already_trialing", status: "TRIALING" },
    });
    sessionUserId = user.id;

    await expect(createCheckoutSession("ANNUAL")).rejects.toThrow(/ya tienes/i);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("[Fase 12C] un usuario con PRO activo vía RevenueCat (móvil) tampoco puede abrir un checkout de Stripe — la protección anti-duplicado ahora mira CUALQUIER provider", async () => {
    const user = await makeUser("already-pro-via-revenuecat");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id, status: "ACTIVE" },
    });
    sessionUserId = user.id;

    await expect(createCheckoutSession("MONTHLY")).rejects.toThrow(/ya tienes/i);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("un usuario CANCELED (sin acceso Pro actual) sí puede volver a suscribirse", async () => {
    const user = await makeUser("re-subscribe-after-cancel");
    await prisma.subscription.create({
      data: { userId: user.id, providerCustomerId: "cus_resub", status: "CANCELED" },
    });
    // Fase 12C: hasUsedTrial vive en User, no en Subscription.
    await prisma.user.update({ where: { id: user.id }, data: { hasUsedTrial: true } });
    sessionUserId = user.id;

    await runIgnoringRedirect(() => createCheckoutSession("MONTHLY"));
    expect(checkoutSessionsCreate).toHaveBeenCalled();
    // Ya usó el trial antes — no se le vuelve a conceder.
    const lastCall = checkoutSessionsCreate.mock.calls.at(-1)![0] as { subscription_data?: unknown };
    expect(lastCall.subscription_data).toBeUndefined();
  });

  it("[fix de audit] un intervalo inválido (fuera de MONTHLY/ANNUAL) se rechaza en vez de caer en un precio por defecto", async () => {
    const user = await makeUser("invalid-interval");
    sessionUserId = user.id;

    // @ts-expect-error — se fuerza un valor fuera del tipo BillingInterval a propósito, simulando una petición manipulada.
    await expect(createCheckoutSession("YEARLY")).rejects.toThrow(/intervalo/i);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("[fix de audit] dos checkouts concurrentes del mismo usuario nuevo (doble tap) no rompen — solo se crea una Subscription", async () => {
    const user = await makeUser("double-tap");
    sessionUserId = user.id;

    await Promise.all([
      runIgnoringRedirect(() => createCheckoutSession("MONTHLY")),
      runIgnoringRedirect(() => createCheckoutSession("MONTHLY")),
    ]);

    const subs = await prisma.subscription.findMany({ where: { userId: user.id } });
    expect(subs).toHaveLength(1); // nunca dos filas para el mismo usuario, ninguna petición murió con un 500
  });
});
