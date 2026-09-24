import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { dictionaries } from "@/lib/i18n/dictionaries";

/**
 * Borrado de cuenta (App Store 5.1.1(v)). Integración con DB real: el User
 * y todo lo que cuelga de él desaparece, la suscripción de Stripe se
 * cancela ANTES de borrar nada, y si esa cancelación falla no se borra
 * nada (nunca dejar a alguien pagando por una cuenta que ya no existe).
 */

let sessionUserId = "";
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => (sessionUserId ? { user: { id: sessionUserId, email: "x@example.com", name: "X" } } : null)),
}));
vi.mock("@/lib/i18n/current-locale", () => ({ getDictionary: async () => ({ locale: "es", t: dictionaries.es }) }));
const cookieDelete = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: cookieDelete }) }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma tipada para poder inspeccionar *.mock.calls
const subscriptionsCancel = vi.fn(async (_id: string) => ({}));
vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return { ...actual, stripe: { subscriptions: { cancel: subscriptionsCancel } } };
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma tipada para poder inspeccionar *.mock.calls
const blobDel = vi.fn(async (_urls: string[]) => {});
vi.mock("@vercel/blob", () => ({ del: blobDel }));

const { deleteAccount } = await import("@/actions/account");

const CONFIRM = dictionaries.es.perfil.deleteAccountConfirmWord;

function form(confirm: string) {
  const fd = new FormData();
  fd.set("confirm", confirm);
  return fd;
}

describe("deleteAccount (integración, DB real)", () => {
  const ORIGINAL_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  const userIds: string[] = [];

  async function makeUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `delete-account-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com` },
    });
    userIds.push(user.id);
    return user;
  }

  beforeEach(() => {
    subscriptionsCancel.mockReset();
    subscriptionsCancel.mockImplementation(async () => ({}));
    blobDel.mockClear();
    cookieDelete.mockClear();
  });

  afterAll(async () => {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_SECRET_KEY;
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("sin la palabra de confirmación exacta no borra nada", async () => {
    const user = await makeUser("no-confirm");
    sessionUserId = user.id;

    const result = await deleteAccount(undefined, form("borrar"));
    expect(result?.error).toBe(dictionaries.es.perfil.deleteAccountConfirmMismatch);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("sin sesión no borra nada", async () => {
    sessionUserId = "";
    const result = await deleteAccount(undefined, form(CONFIRM));
    expect(result?.error).toBe(dictionaries.es.perfil.deleteAccountError);
  });

  it("borra el User, sus datos en cascada y sus vídeos de Blob, y cancela antes la suscripción de Stripe", async () => {
    const user = await makeUser("full");
    sessionUserId = user.id;
    await prisma.subscription.create({
      data: {
        userId: user.id,
        provider: "STRIPE",
        providerCustomerId: `cus_del_${user.id}`,
        providerSubscriptionId: `sub_del_${user.id}`,
        status: "ACTIVE",
      },
    });
    await prisma.swingVideo.create({
      data: { userId: user.id, videoUrl: "https://blob.example.com/swing-1.mp4", analysisRequestId: `req_del_${user.id}` },
    });
    await prisma.session.create({
      data: { userId: user.id, sessionToken: `tok_del_${user.id}`, expires: new Date(Date.now() + 86_400_000) },
    });

    const result = await deleteAccount(undefined, form(CONFIRM.toLowerCase()));
    expect(result).toEqual({ deleted: true });

    expect(subscriptionsCancel).toHaveBeenCalledWith(`sub_del_${user.id}`);
    expect(blobDel).toHaveBeenCalledWith(["https://blob.example.com/swing-1.mp4"]);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.subscription.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.swingVideo.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(cookieDelete).toHaveBeenCalledWith("__Secure-authjs.session-token");
  });

  it("si Stripe no deja cancelar la suscripción, NO se borra la cuenta", async () => {
    const user = await makeUser("stripe-fails");
    sessionUserId = user.id;
    await prisma.subscription.create({
      data: {
        userId: user.id,
        provider: "STRIPE",
        providerCustomerId: `cus_del_${user.id}`,
        providerSubscriptionId: `sub_del_${user.id}`,
        status: "ACTIVE",
      },
    });
    subscriptionsCancel.mockRejectedValueOnce(new Error("Stripe caído"));

    const result = await deleteAccount(undefined, form(CONFIRM));
    expect(result?.error).toBe(dictionaries.es.perfil.deleteAccountError);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("una suscripción de Stripe ya cancelada no se vuelve a cancelar", async () => {
    const user = await makeUser("already-canceled");
    sessionUserId = user.id;
    await prisma.subscription.create({
      data: {
        userId: user.id,
        provider: "STRIPE",
        providerCustomerId: `cus_del_${user.id}`,
        providerSubscriptionId: `sub_del_${user.id}`,
        status: "CANCELED",
      },
    });

    const result = await deleteAccount(undefined, form(CONFIRM));
    expect(result).toEqual({ deleted: true });
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });
});
