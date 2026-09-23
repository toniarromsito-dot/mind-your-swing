import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Fase 11E — createVoicePackCheckoutSession: compra única (mode:"payment")
 * de 60 min de Voice, requiere Pro, reutiliza el customer existente, nunca
 * bloquea una segunda compra legítima.
 */

let sessionUserId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (sessionUserId ? { user: { id: sessionUserId, email: "x@example.com", name: "X" } } : null)) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT", url });
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma tipada para poder inspeccionar *.mock.calls
const checkoutSessionsCreate = vi.fn(async (_opts: unknown) => ({ url: "https://checkout.stripe.com/voice-pack-test" }));

vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    stripe: {
      checkout: { sessions: { create: checkoutSessionsCreate } },
    },
  };
});

const { createVoicePackCheckoutSession } = await import("@/actions/stripe");

async function runIgnoringRedirect(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if ((e as { digest?: string })?.digest !== "NEXT_REDIRECT") throw e;
  }
}

describe("createVoicePackCheckoutSession (integración, DB real)", () => {
  const userIds: string[] = [];
  const ORIGINAL_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const ORIGINAL_VOICE_PACK_PRICE = process.env.STRIPE_VOICE_PACK_PRICE_ID;

  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_VOICE_PACK_PRICE_ID = "price_voice_pack_test";

  async function makeUser(label: string, plan: "FREE" | "PRO" = "PRO") {
    const user = await prisma.user.create({
      data: { email: `voice-pack-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, plan },
    });
    userIds.push(user.id);
    return user;
  }

  async function makeSubscribedUser(label: string, customerId: string) {
    const user = await makeUser(label, "PRO");
    await prisma.subscription.create({
      data: { userId: user.id, providerCustomerId: customerId, status: "ACTIVE" },
    });
    return user;
  }

  beforeEach(() => {
    checkoutSessionsCreate.mockClear();
  });

  afterEach(() => {
    sessionUserId = "";
  });

  afterAll(async () => {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET_KEY;
    process.env.STRIPE_VOICE_PACK_PRICE_ID = ORIGINAL_VOICE_PACK_PRICE;
    await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("16. FREE no puede crear un checkout de pack de Voice", async () => {
    const free = await makeUser("free-blocked", "FREE");
    sessionUserId = free.id;

    await expect(createVoicePackCheckoutSession()).rejects.toThrow(/pro/i);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("un PRO sin ninguna Subscription (nunca pasó por checkout) no puede comprar un pack", async () => {
    const pro = await makeUser("pro-no-subscription", "PRO");
    sessionUserId = pro.id;

    await expect(createVoicePackCheckoutSession()).rejects.toThrow(/suscripción/i);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("17. PRO con Subscription puede crear el checkout del pack", async () => {
    const pro = await makeSubscribedUser("pro-can-buy", "cus_voice_pack_1");
    sessionUserId = pro.id;

    await runIgnoringRedirect(() => createVoicePackCheckoutSession());
    expect(checkoutSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("18. mode='payment' (nunca subscription), Price one-time correcto, metadata inequívoca", async () => {
    const pro = await makeSubscribedUser("pro-payload", "cus_voice_pack_2");
    sessionUserId = pro.id;

    await runIgnoringRedirect(() => createVoicePackCheckoutSession());
    const call = checkoutSessionsCreate.mock.calls.at(-1)![0] as {
      mode: string;
      line_items: { price: string }[];
      metadata: Record<string, string>;
      customer: string;
    };
    expect(call.mode).toBe("payment");
    expect(call.line_items[0].price).toBe("price_voice_pack_test");
    expect(call.metadata).toEqual({ userId: pro.id, product: "voice_pack_60min" });
    expect(call.customer).toBe("cus_voice_pack_2"); // reutiliza el customer existente, no crea uno nuevo
  });

  it("dos compras legítimas del mismo usuario NO se bloquean — comprar dos packs es válido", async () => {
    const pro = await makeSubscribedUser("pro-buys-twice", "cus_voice_pack_3");
    sessionUserId = pro.id;

    await runIgnoringRedirect(() => createVoicePackCheckoutSession());
    await runIgnoringRedirect(() => createVoicePackCheckoutSession());

    expect(checkoutSessionsCreate).toHaveBeenCalledTimes(2); // ambas se crean, ninguna se rechaza
  });

  it("sin sesión activa redirige a / sin crear ningún checkout", async () => {
    sessionUserId = "";
    await expect(createVoicePackCheckoutSession()).rejects.toMatchObject({ digest: "NEXT_REDIRECT", url: "/" });
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });
});
