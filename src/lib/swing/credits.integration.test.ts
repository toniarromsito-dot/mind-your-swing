import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  currentSwingAiPeriod,
  getSwingAiCreditStatus,
  releaseSwingAiCredit,
  SWING_AI_MONTHLY_LIMIT,
  tryConsumeSwingAiCredit,
} from "./credits";

/**
 * Fase 11D — mecánica de créditos de Swing AI aislada de submitSwingVideo:
 * consumo atómico, liberación, y el límite de un periodo nunca afecta al
 * siguiente. La idempotencia end-to-end (analysisRequestId) y la política
 * de "pose inválida/error técnico no consumen" se prueban en
 * src/actions/swing-videos.credits.integration.test.ts, que sí pasa por el
 * flujo completo.
 */
describe("créditos de Swing AI — mecánica atómica (integración, DB real)", () => {
  const userIds: string[] = [];

  async function makeUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `swing-credits-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, plan: "PRO" },
    });
    userIds.push(user.id);
    return user;
  }

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await prisma.swingAiCreditPeriod.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("un usuario nuevo empieza el periodo con el límite completo disponible", async () => {
    const user = await makeUser("fresh");
    const status = await getSwingAiCreditStatus(user.id);
    expect(status.limit).toBe(SWING_AI_MONTHLY_LIMIT);
    expect(status.used).toBe(0);
    expect(status.remaining).toBe(SWING_AI_MONTHLY_LIMIT);
    expect(status.period).toBe(currentSwingAiPeriod());
  });

  it("3. primer consumo válido → 7 restantes", async () => {
    const user = await makeUser("first-consume");
    const result = await tryConsumeSwingAiCredit(user.id);
    expect(result.ok).toBe(true);
    expect(result.status.used).toBe(1);
    expect(result.status.remaining).toBe(7);
  });

  it("4. octavo consumo válido → 0 restantes", async () => {
    const user = await makeUser("eighth-consume");
    for (let i = 0; i < 7; i++) {
      await tryConsumeSwingAiCredit(user.id);
    }
    const eighth = await tryConsumeSwingAiCredit(user.id);
    expect(eighth.ok).toBe(true);
    expect(eighth.status.used).toBe(8);
    expect(eighth.status.remaining).toBe(0);
  });

  it("5. noveno consumo → rechazado, el contador no pasa de 8", async () => {
    const user = await makeUser("ninth-consume");
    for (let i = 0; i < 8; i++) {
      await tryConsumeSwingAiCredit(user.id);
    }
    const ninth = await tryConsumeSwingAiCredit(user.id);
    expect(ninth.ok).toBe(false);
    expect(ninth.status.used).toBe(8);
    expect(ninth.status.remaining).toBe(0);
  });

  it("10. dos requests concurrentes con 1 crédito restante → solamente una consume", async () => {
    const user = await makeUser("concurrent-one-left");
    for (let i = 0; i < 7; i++) {
      await tryConsumeSwingAiCredit(user.id);
    }
    const before = await getSwingAiCreditStatus(user.id);
    expect(before.remaining).toBe(1);

    const [a, b] = await Promise.all([tryConsumeSwingAiCredit(user.id), tryConsumeSwingAiCredit(user.id)]);
    const oks = [a, b].filter((r) => r.ok);
    expect(oks).toHaveLength(1); // exactamente una de las dos ganó

    const after = await getSwingAiCreditStatus(user.id);
    expect(after.used).toBe(8);
    expect(after.remaining).toBe(0);
  });

  it("11. dos requests concurrentes con 2 créditos restantes → como máximo dos consumos", async () => {
    const user = await makeUser("concurrent-two-left");
    for (let i = 0; i < 6; i++) {
      await tryConsumeSwingAiCredit(user.id);
    }
    const before = await getSwingAiCreditStatus(user.id);
    expect(before.remaining).toBe(2);

    const [a, b] = await Promise.all([tryConsumeSwingAiCredit(user.id), tryConsumeSwingAiCredit(user.id)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const after = await getSwingAiCreditStatus(user.id);
    expect(after.used).toBe(8); // nunca más de 8, ni con dos escrituras concurrentes
  });

  it("liberar un crédito lo devuelve al saldo, y nunca lo deja negativo", async () => {
    const user = await makeUser("release");
    await tryConsumeSwingAiCredit(user.id);
    await tryConsumeSwingAiCredit(user.id);
    await releaseSwingAiCredit(user.id);
    const status = await getSwingAiCreditStatus(user.id);
    expect(status.used).toBe(1);

    // Liberar de más (usuario ya en 0) nunca lo deja en negativo.
    await releaseSwingAiCredit(user.id);
    await releaseSwingAiCredit(user.id);
    const floor = await getSwingAiCreditStatus(user.id);
    expect(floor.used).toBe(0);
  });

  it("14. cambio de periodo → nuevo saldo de 8, el consumo de un mes no afecta al siguiente", async () => {
    const user = await makeUser("period-change");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    for (let i = 0; i < 8; i++) {
      const r = await tryConsumeSwingAiCredit(user.id);
      expect(r.ok).toBe(true);
    }
    const january = await getSwingAiCreditStatus(user.id);
    expect(january.period).toBe("2026-01");
    expect(january.remaining).toBe(0);

    vi.setSystemTime(new Date("2026-02-01T00:00:01Z"));
    const february = await getSwingAiCreditStatus(user.id);
    expect(february.period).toBe("2026-02");
    expect(february.used).toBe(0);
    expect(february.remaining).toBe(SWING_AI_MONTHLY_LIMIT);
  });

  it("12. el consumo de un usuario nunca toca el saldo de otro usuario", async () => {
    const userA = await makeUser("owner-a");
    const userB = await makeUser("owner-b");

    for (let i = 0; i < 5; i++) {
      await tryConsumeSwingAiCredit(userA.id);
    }

    const statusA = await getSwingAiCreditStatus(userA.id);
    const statusB = await getSwingAiCreditStatus(userB.id);
    expect(statusA.used).toBe(5);
    expect(statusB.used).toBe(0);
    expect(statusB.remaining).toBe(SWING_AI_MONTHLY_LIMIT);
  });
});
