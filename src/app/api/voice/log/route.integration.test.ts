import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getVoiceCreditStatus, VOICE_INCLUDED_SECONDS } from "@/lib/voice/credits";

/**
 * Fase 11E — /api/voice/log evolucionado: auth, validación, rate limit
 * propio (separado del saldo de créditos) e idempotencia real por
 * conversationId a nivel de endpoint HTTP completo.
 */

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)) }));

const { POST } = await import("./route");

function req(body: unknown) {
  return new Request("http://localhost/api/voice/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/voice/log (integración, DB real)", () => {
  const userIds: string[] = [];
  let idSeq = 0;
  const nextConvId = () => `route-conv-${Date.now()}-${idSeq++}`;

  async function makeUser(label: string, plan: "FREE" | "PRO" = "PRO") {
    const user = await prisma.user.create({
      data: { email: `voice-log-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, plan },
    });
    userIds.push(user.id);
    return user;
  }

  afterEach(() => {
    userId = "";
  });

  afterAll(async () => {
    await prisma.voiceCallLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.voiceCreditPeriod.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.voicePurchasedBalance.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("22. sin sesión → 401, no toca nada", async () => {
    userId = "";
    const res = await POST(req({ durationSeconds: 60, conversationId: "x" }));
    expect(res.status).toBe(401);
  });

  it("conversationId obligatorio cuando durationSeconds > 0", async () => {
    const user = await makeUser("no-conv-id");
    userId = user.id;
    const res = await POST(req({ durationSeconds: 60 }));
    expect(res.status).toBe(400);
    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO); // nada consumido
  });

  it("durationSeconds = 0 es un no-op válido (sin conversationId, no rompe)", async () => {
    const user = await makeUser("zero-duration");
    userId = user.id;
    const res = await POST(req({ durationSeconds: 0 }));
    expect(res.status).toBe(200);
    const rows = await prisma.voiceCallLog.count({ where: { userId: user.id } });
    expect(rows).toBe(0);
  });

  it("durationSeconds fuera de 0-3600 → 400", async () => {
    const user = await makeUser("out-of-range");
    userId = user.id;
    const res = await POST(req({ durationSeconds: 3601, conversationId: nextConvId() }));
    expect(res.status).toBe(400);
  });

  it("hardening 51: durationSeconds negativo → 400, nada consumido", async () => {
    const user = await makeUser("negative-duration");
    userId = user.id;
    const res = await POST(req({ durationSeconds: -5, conversationId: nextConvId() }));
    expect(res.status).toBe(400);
    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO);
  });

  it("hardening 51: durationSeconds decimal → 400 (solo enteros)", async () => {
    const user = await makeUser("decimal-duration");
    userId = user.id;
    const res = await POST(req({ durationSeconds: 12.5, conversationId: nextConvId() }));
    expect(res.status).toBe(400);
  });

  it("hardening 51: durationSeconds como string no numérico → 400, no revienta con un 500", async () => {
    const user = await makeUser("string-duration");
    userId = user.id;
    const res = await POST(req({ durationSeconds: "no-soy-un-numero", conversationId: nextConvId() }));
    expect(res.status).toBe(400);
  });

  it("hardening 51: conversationId vacío/solo espacios → 400 (obligatorio y no vacío cuando durationSeconds > 0)", async () => {
    const user = await makeUser("blank-conv-id");
    userId = user.id;
    const res = await POST(req({ durationSeconds: 60, conversationId: "   " }));
    expect(res.status).toBe(400);
    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO);
  });

  it("una llamada real consume el ledger vía el endpoint completo", async () => {
    const user = await makeUser("real-call");
    userId = user.id;
    const res = await POST(req({ durationSeconds: 120, conversationId: nextConvId() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(false);

    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO - 120);
  });

  it("24. retry del mismo conversationId a través del endpoint completo sigue siendo idempotente", async () => {
    const user = await makeUser("route-retry");
    userId = user.id;
    const convId = nextConvId();

    await POST(req({ durationSeconds: 90, conversationId: convId }));
    const second = await POST(req({ durationSeconds: 90, conversationId: convId }));
    const body = await second.json();
    expect(body.idempotent).toBe(true);

    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO - 90); // no 180
  });

  it("userId siempre sale de la sesión — el body nunca puede suplantarlo (no existe ningún campo userId en el schema de entrada)", async () => {
    const attacker = await makeUser("attacker");
    const victim = await makeUser("victim");
    userId = attacker.id;

    // Campo userId fabricado en el body — el endpoint no lo lee en absoluto (req() acepta `unknown`).
    await POST(req({ durationSeconds: 60, conversationId: nextConvId(), userId: victim.id }));

    const victimStatus = await getVoiceCreditStatus(victim.id, "PRO");
    expect(victimStatus.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO); // la víctima no perdió nada
    const attackerStatus = await getVoiceCreditStatus(attacker.id, "PRO");
    expect(attackerStatus.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO - 60); // se descontó al que llamó de verdad
  });

  it("23. rate limit propio del endpoint — separado del saldo de créditos", async () => {
    const user = await makeUser("rate-limited");
    userId = user.id;

    for (let i = 0; i < 20; i++) {
      const res = await POST(req({ durationSeconds: 1, conversationId: nextConvId() }));
      expect(res.status).toBe(200);
    }

    const res21 = await POST(req({ durationSeconds: 1, conversationId: nextConvId() }));
    expect(res21.status).toBe(429);

    // El rate limit rechazó el intento 21 — el saldo solo refleja los 20 reales.
    const status = await getVoiceCreditStatus(user.id, "PRO");
    expect(status.includedRemainingSeconds).toBe(VOICE_INCLUDED_SECONDS.PRO - 20);
  });
});
