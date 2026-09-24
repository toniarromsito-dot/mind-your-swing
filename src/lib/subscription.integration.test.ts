import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recomputeUserPlan } from "./subscription";

/**
 * Fase 12C — SUBSCRIPTION MULTI-PROVIDER FOUNDATION. Integración con DB
 * real: la garantía de cardinalidad (@@unique([userId, provider])) es la
 * base de toda la fase — sin ella, Stripe + RevenueCat no podrían convivir
 * sin pisarse (ver auditoría crítica previa a esta implementación).
 */

describe("Subscription — cardinalidad multi-provider (integración, DB real)", () => {
  const userIds: string[] = [];

  async function makeUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `sub-card-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com` },
    });
    userIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("usuario + Stripe → válido", async () => {
    const user = await makeUser("stripe-only");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}` },
    });
    const rows = await prisma.subscription.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("STRIPE");
  });

  it("usuario + RevenueCat → válido", async () => {
    const user = await makeUser("rc-only");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id },
    });
    const rows = await prisma.subscription.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("REVENUECAT");
  });

  it("usuario + Stripe + RevenueCat simultáneos → válido — el caso central de esta fase", async () => {
    const user = await makeUser("both");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}` },
    });
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id },
    });
    const rows = await prisma.subscription.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.provider).sort()).toEqual(["REVENUECAT", "STRIPE"]);
  });

  it("usuario + 2 Stripe → rechazado (P2002 en (userId, provider))", async () => {
    const user = await makeUser("dup-stripe");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_a_${user.id}` },
    });
    await expect(
      prisma.subscription.create({
        data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_b_${user.id}` },
      })
    ).rejects.toMatchObject({ code: "P2002" });
    // Confirma que el rechazo no dejó una segunda fila a medias.
    const rows = await prisma.subscription.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
  });

  it("usuario + 2 RevenueCat → rechazado", async () => {
    const user = await makeUser("dup-rc");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: `rc_a_${user.id}` },
    });
    await expect(
      prisma.subscription.create({
        data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: `rc_b_${user.id}` },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("providerCustomerId sigue siendo único GLOBAL — dos usuarios no pueden compartir el mismo customer de ningún provider", async () => {
    const userA = await makeUser("global-unique-a");
    const userB = await makeUser("global-unique-b");
    await prisma.subscription.create({
      data: { userId: userA.id, provider: "STRIPE", providerCustomerId: "cus_shared_test" },
    });
    await expect(
      prisma.subscription.create({
        data: { userId: userB.id, provider: "STRIPE", providerCustomerId: "cus_shared_test" },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("recomputeUserPlan — Fase 12C (integración, DB real)", () => {
  const userIds: string[] = [];

  async function makeUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `recompute-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com` },
    });
    userIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function planOf(userId: string) {
    return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan;
  }

  it("Stripe ACTIVE → PRO", async () => {
    const user = await makeUser("stripe-active");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "ACTIVE" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("PRO");
  });

  it("RevenueCat ACTIVE → PRO", async () => {
    const user = await makeUser("rc-active");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id, status: "ACTIVE" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("PRO");
  });

  it("ambas ACTIVE → PRO", async () => {
    const user = await makeUser("both-active");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "ACTIVE" },
    });
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id, status: "ACTIVE" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("PRO");
  });

  it("Stripe CANCELED + RevenueCat ACTIVE → PRO (cancelar uno no debe tumbar el otro)", async () => {
    const user = await makeUser("stripe-canceled-rc-active");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "CANCELED" },
    });
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id, status: "ACTIVE" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("PRO");
  });

  it("Stripe ACTIVE + RevenueCat CANCELED → PRO (simétrico al caso anterior)", async () => {
    const user = await makeUser("stripe-active-rc-canceled");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "ACTIVE" },
    });
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id, status: "CANCELED" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("PRO");
  });

  it("ambas CANCELED → FREE", async () => {
    const user = await makeUser("both-canceled");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "CANCELED" },
    });
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id, status: "CANCELED" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("FREE");
  });

  it("PAST_DUE sin otra activa → FREE (misma política que Stripe: sin acceso hasta que se resuelva)", async () => {
    const user = await makeUser("past-due-alone");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "PAST_DUE" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("FREE");
  });

  it("PAST_DUE en un provider + ACTIVE en otro → PRO (el problema de pago de uno no debe tumbar el acceso ganado por el otro)", async () => {
    const user = await makeUser("past-due-plus-active");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "PAST_DUE" },
    });
    await prisma.subscription.create({
      data: { userId: user.id, provider: "REVENUECAT", providerCustomerId: user.id, status: "ACTIVE" },
    });
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("PRO");
  });

  it("sin ninguna Subscription → FREE", async () => {
    const user = await makeUser("no-subscription");
    await recomputeUserPlan(prisma, user.id);
    expect(await planOf(user.id)).toBe("FREE");
  });
});
