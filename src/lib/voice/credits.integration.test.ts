import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  creditVoicePurchasedSeconds,
  getVoiceCreditStatus,
  tryConsumeVoiceCredit,
  VOICE_INCLUDED_SECONDS,
} from "./credits";

/**
 * Fase 11E — Voice Credits. Integración con DB real: consumo atómico
 * (included primero, purchased después, nunca deuda), idempotencia real
 * por conversationId (incluida la carrera genuina, no solo el camino
 * rápido secuencial), y que el saldo comprado sobrevive al cambio de mes
 * mientras el incluido se reinicia solo.
 */
describe("Voice Credits — consumo atómico (integración, DB real)", () => {
  const userIds: string[] = [];
  let idSeq = 0;
  const nextConvId = () => `conv-${Date.now()}-${idSeq++}`;

  async function makeUser(label: string, plan: "FREE" | "PRO" = "PRO") {
    const user = await prisma.user.create({
      data: { email: `voice-credits-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, plan },
    });
    userIds.push(user.id);
    return user;
  }

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await prisma.voiceCallLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.voiceCreditPeriod.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.voicePurchasedBalance.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("1. primera llamada consume de included", async () => {
    const user = await makeUser("first-call");
    const result = await tryConsumeVoiceCredit(user.id, "PRO", 60, nextConvId());
    expect(result.idempotent).toBe(false);
    expect(result.fromIncludedSeconds).toBe(60);
    expect(result.fromPurchasedSeconds).toBe(0);
    expect(result.status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO - 60);
  });

  it("2/3. included agotado → el resto se consume de purchased", async () => {
    const user = await makeUser("included-exhausted", "FREE"); // FREE = 300s incluidos
    await creditVoicePurchasedSeconds(user.id, 120);

    await tryConsumeVoiceCredit(user.id, "FREE", 300, nextConvId()); // agota los 300 incluidos
    const afterFirst = await getVoiceCreditStatus(user.id, "FREE");
    expect(afterFirst.includedRemainingSeconds).toBe(0);
    expect(afterFirst.purchasedRemainingSeconds).toBe(120);

    const second = await tryConsumeVoiceCredit(user.id, "FREE", 60, nextConvId());
    expect(second.fromIncludedSeconds).toBe(0);
    expect(second.fromPurchasedSeconds).toBe(60);
  });

  it("4. una sola llamada que cruza included + purchased se reparte correctamente (ejemplo de la spec: 30s + 120s, duración 90s → 30 included + 60 purchased)", async () => {
    const user = await makeUser("split-call", "FREE");
    // Deja included con exactamente 30s restantes.
    await tryConsumeVoiceCredit(user.id, "FREE", VOICE_INCLUDED_SECONDS.FREE - 30, nextConvId());
    await creditVoicePurchasedSeconds(user.id, 120);

    const result = await tryConsumeVoiceCredit(user.id, "FREE", 90, nextConvId());
    expect(result.fromIncludedSeconds).toBe(30);
    expect(result.fromPurchasedSeconds).toBe(60);

    const status = await getVoiceCreditStatus(user.id, "FREE");
    expect(status.includedRemainingSeconds).toBe(0);
    expect(status.purchasedRemainingSeconds).toBe(60);
  });

  it("5/6. saldo total insuficiente → se absorbe el exceso, nunca deuda ni negativo (ejemplo de la spec: 30s + 20s, duración 90s → exceso 40s)", async () => {
    const user = await makeUser("insufficient-total", "FREE");
    await tryConsumeVoiceCredit(user.id, "FREE", VOICE_INCLUDED_SECONDS.FREE - 30, nextConvId());
    await creditVoicePurchasedSeconds(user.id, 20);

    const result = await tryConsumeVoiceCredit(user.id, "FREE", 90, nextConvId());
    expect(result.fromIncludedSeconds).toBe(30);
    expect(result.fromPurchasedSeconds).toBe(20);
    // 90 - 30 - 20 = 40s de exceso, absorbido — no se refleja en ningún sitio.

    const status = await getVoiceCreditStatus(user.id, "FREE");
    expect(status.includedRemainingSeconds).toBe(0);
    expect(status.purchasedRemainingSeconds).toBe(0); // nunca negativo
  });

  it("7. mismo conversationId dos veces (secuencial) → idempotente, no vuelve a consumir", async () => {
    const user = await makeUser("same-conv-sequential", "PRO");
    const convId = nextConvId();

    const first = await tryConsumeVoiceCredit(user.id, "PRO", 100, convId);
    expect(first.idempotent).toBe(false);
    expect(first.fromIncludedSeconds).toBe(100);

    const second = await tryConsumeVoiceCredit(user.id, "PRO", 100, convId);
    expect(second.idempotent).toBe(true);
    expect(second.fromIncludedSeconds).toBe(0);
    expect(second.fromPurchasedSeconds).toBe(0);

    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO - 100); // solo se descontó una vez

    const rows = await prisma.voiceCallLog.count({ where: { userId: user.id, conversationId: convId } });
    expect(rows).toBe(1);
  });

  it("8. mismo conversationId con dos requests REALMENTE concurrentes → un único descuento, la carrera la cierra la DB", async () => {
    const user = await makeUser("same-conv-concurrent", "PRO");
    const convId = nextConvId();

    const [a, b] = await Promise.all([
      tryConsumeVoiceCredit(user.id, "PRO", 100, convId),
      tryConsumeVoiceCredit(user.id, "PRO", 100, convId),
    ]);

    // Exactamente una de las dos hizo el consumo real; la otra queda como idempotente.
    const idempotentCount = [a, b].filter((r) => r.idempotent).length;
    const realCount = [a, b].filter((r) => !r.idempotent).length;
    expect(idempotentCount).toBe(1);
    expect(realCount).toBe(1);

    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO - 100); // nunca 200 descontados

    const rows = await prisma.voiceCallLog.count({ where: { userId: user.id, conversationId: convId } });
    expect(rows).toBe(1);
  });

  it("9/10. dos llamadas DISTINTAS concurrentes agotando el mismo saldo exacto → ninguna deja saldo negativo, el total consumido nunca supera lo disponible", async () => {
    const user = await makeUser("exact-balance-race", "FREE"); // 300s incluidos, sin purchased
    const convA = nextConvId();
    const convB = nextConvId();

    // Cada request pide 300s (el saldo entero) — solo una puede llevárselo todo.
    const [a, b] = await Promise.all([
      tryConsumeVoiceCredit(user.id, "FREE", 300, convA),
      tryConsumeVoiceCredit(user.id, "FREE", 300, convB),
    ]);

    const totalConsumed = a.fromIncludedSeconds + a.fromPurchasedSeconds + b.fromIncludedSeconds + b.fromPurchasedSeconds;
    expect(totalConsumed).toBe(300); // nunca más de lo que había disponible

    const status = await getVoiceCreditStatus(user.id, "FREE");
    expect(status.includedRemainingSeconds).toBe(0);
    expect(status.purchasedRemainingSeconds).toBe(0); // nunca negativo
  });

  it("11. cambio de periodo → included se reinicia solo, purchased sobrevive intacto", async () => {
    const user = await makeUser("month-rollover", "PRO");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    await creditVoicePurchasedSeconds(user.id, 500);
    await tryConsumeVoiceCredit(user.id, "PRO", VOICE_INCLUDED_SECONDS.PRO, nextConvId()); // agota included de enero
    const january = await getVoiceCreditStatus(user.id, "PRO");
    expect(january.period).toBe("2026-01");
    expect(january.includedRemainingSeconds).toBe(0);
    expect(january.purchasedRemainingSeconds).toBe(500);

    vi.setSystemTime(new Date("2026-02-01T00:00:01Z"));
    const february = await getVoiceCreditStatus(user.id, "PRO");
    expect(february.period).toBe("2026-02");
    expect(february.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO); // 15. purchased sobrevive al cambio de mes
    expect(february.purchasedRemainingSeconds).toBe(500);

    vi.useRealTimers();
  });

  it("12. VoiceCallLog histórico (sin conversationId) no afecta al ledger nuevo", async () => {
    const user = await makeUser("historical-log-ignored", "PRO");
    // Simula una fila histórica anterior a esta fase: sin conversationId.
    await prisma.voiceCallLog.create({ data: { userId: user.id, durationSeconds: 500 } });

    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO); // el histórico no se re-imputa
  });

  it("13. FREE agotado (300s) queda bloqueado — included y purchased ambos en 0", async () => {
    const user = await makeUser("free-exhausted", "FREE");
    await tryConsumeVoiceCredit(user.id, "FREE", 300, nextConvId());
    const status = await getVoiceCreditStatus(user.id, "FREE");
    expect(status.includedRemainingSeconds + status.purchasedRemainingSeconds).toBe(0);
  });

  it("14. PRO permite hasta 2400s (40 min) incluidos", async () => {
    const user = await makeUser("pro-full-allowance", "PRO");
    const result = await tryConsumeVoiceCredit(user.id, "PRO", 2400, nextConvId());
    expect(result.fromIncludedSeconds).toBe(2400);
    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(0);
  });

  it("acreditar un pack (creditVoicePurchasedSeconds) es aditivo y seguro con dos acreditaciones concurrentes reales", async () => {
    const user = await makeUser("credit-pack-concurrent");
    await Promise.all([
      creditVoicePurchasedSeconds(user.id, 3600),
      creditVoicePurchasedSeconds(user.id, 3600),
    ]);
    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.purchasedRemainingSeconds).toBe(7200); // dos packs reales, las dos se suman
  });

  it("ownership: el consumo de un usuario nunca toca el saldo de otro", async () => {
    const userA = await makeUser("owner-a");
    const userB = await makeUser("owner-b");
    await tryConsumeVoiceCredit(userA.id, "PRO", 500, nextConvId());
    const statusB = await getVoiceCreditStatus(userB.id, "PRO");
    expect(statusB.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO);
  });

  // ---- Hardening sección 46/49 ----

  it("hardening 49: el exceso sobre el saldo total queda registrado en excessSeconds — observable, sin convertirse en deuda", async () => {
    const user = await makeUser("excess-observable", "FREE");
    await tryConsumeVoiceCredit(user.id, "FREE", VOICE_INCLUDED_SECONDS.FREE - 30, nextConvId());
    await creditVoicePurchasedSeconds(user.id, 20);
    const convId = nextConvId();

    const result = await tryConsumeVoiceCredit(user.id, "FREE", 90, convId); // 30 included + 20 purchased + 40 exceso
    expect(result.excessSeconds).toBe(40);

    const row = await prisma.voiceCallLog.findUniqueOrThrow({ where: { conversationId: convId } });
    expect(row.excessSeconds).toBe(40);

    // El exceso es un hecho de ESTA llamada, no un saldo — sigue en 0, nunca negativo.
    const status = await getVoiceCreditStatus(user.id, "FREE");
    expect(status.includedRemainingSeconds + status.purchasedRemainingSeconds).toBe(0);
  });

  it("hardening 49: una llamada sin exceso queda con excessSeconds = 0", async () => {
    const user = await makeUser("no-excess", "PRO");
    const convId = nextConvId();
    await tryConsumeVoiceCredit(user.id, "PRO", 60, convId);
    const row = await prisma.voiceCallLog.findUniqueOrThrow({ where: { conversationId: convId } });
    expect(row.excessSeconds).toBe(0);
  });

  it("hardening 46: la DB rechaza un remainingSeconds negativo a nivel de CHECK constraint, aunque se intente escribir por fuera de la lógica de aplicación", async () => {
    const user = await makeUser("check-constraint-purchased");
    await creditVoicePurchasedSeconds(user.id, 10);
    await expect(
      prisma.$executeRaw`UPDATE "VoicePurchasedBalance" SET "remainingSeconds" = -1 WHERE "userId" = ${user.id}`
    ).rejects.toThrow();
    // El valor previo (válido) no se tocó — el UPDATE entero se rechazó.
    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.purchasedRemainingSeconds).toBe(10);
  });

  it("hardening 46: la DB rechaza un consumedSeconds negativo en VoiceCreditPeriod a nivel de CHECK constraint", async () => {
    const user = await makeUser("check-constraint-period");
    await tryConsumeVoiceCredit(user.id, "PRO", 60, nextConvId());
    const period = (await getVoiceCreditStatus(user.id, "PRO")).period;
    await expect(
      prisma.$executeRaw`UPDATE "VoiceCreditPeriod" SET "consumedSeconds" = -1 WHERE "userId" = ${user.id} AND "period" = ${period}`
    ).rejects.toThrow();
  });
});
