import { createHmac } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Fase 12C — webhook de RevenueCat. Integración con DB real: mismo nivel de
 * rigor que el webhook de Stripe (route.integration.test.ts hermano) —
 * firma real (HMAC de verdad, no mockeada), idempotencia, fuera-de-orden,
 * fail-closed ante usuario inexistente, y la independencia real entre la
 * fila STRIPE y la fila REVENUECAT del mismo usuario.
 */

const WEBHOOK_SECRET = "whsec_revenuecat_test";
const ORIGINAL_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;
process.env.REVENUECAT_WEBHOOK_SECRET = WEBHOOK_SECRET;

const { POST } = await import("./route");

function sign(body: string, tSeconds = Math.floor(Date.now() / 1000)) {
  const hmac = createHmac("sha256", WEBHOOK_SECRET).update(`${tSeconds}.${body}`).digest("hex");
  return `t=${tSeconds},v1=${hmac}`;
}

function makeEvent(
  id: string,
  type: string,
  appUserId: string,
  overrides: Partial<{
    period_type: string;
    store: string;
    event_timestamp_ms: number;
    original_transaction_id: string;
    cancel_reason: string;
  }> = {}
) {
  return {
    id,
    type,
    app_user_id: appUserId,
    original_app_user_id: appUserId,
    original_transaction_id: overrides.original_transaction_id ?? `txn_${id}`,
    store: overrides.store ?? "APP_STORE",
    period_type: overrides.period_type ?? "NORMAL",
    cancel_reason: overrides.cancel_reason,
    event_timestamp_ms: overrides.event_timestamp_ms ?? Date.now(),
  };
}

function makeTransferEvent(id: string, from: string[], to: string[], eventTimestampMs = Date.now()) {
  // TRANSFER real de RevenueCat: SIN app_user_id, solo transferred_from/to.
  return { id, type: "TRANSFER", transferred_from: from, transferred_to: to, store: "APP_STORE", event_timestamp_ms: eventTimestampMs };
}

function req(event: object, options: { badSignature?: boolean; noSignature?: boolean } = {}) {
  const body = JSON.stringify({ api_version: "1.0", event });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!options.noSignature) {
    headers["x-revenuecat-webhook-signature"] = options.badSignature ? "t=1,v1=deadbeef" : sign(body);
  }
  return new Request("http://localhost/api/revenuecat/webhook", { method: "POST", headers, body });
}

describe("POST /api/revenuecat/webhook (integración, DB real)", () => {
  const userIds: string[] = [];

  async function makeUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `rc-webhook-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com` },
    });
    userIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = ORIGINAL_SECRET;
    await prisma.subscriptionEvent.deleteMany({});
    await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("evento válido: INITIAL_PURCHASE crea la Subscription(REVENUECAT) y concede PRO", async () => {
    const user = await makeUser("valid");
    const res = await POST(req(makeEvent("evt_rc_valid", "INITIAL_PURCHASE", user.id)));
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.store).toBe("APP_STORE");
    expect(sub.providerCustomerId).toBe(user.id);

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
  });

  it("firma inválida → 400, no toca ningún dato", async () => {
    const user = await makeUser("bad-sig");
    const res = await POST(req(makeEvent("evt_rc_badsig", "INITIAL_PURCHASE", user.id), { badSignature: true }));
    expect(res.status).toBe(400);

    const sub = await prisma.subscription.findUnique({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub).toBeNull();
  });

  it("sin firma → 400", async () => {
    const user = await makeUser("no-sig");
    const res = await POST(req(makeEvent("evt_rc_nosig", "INITIAL_PURCHASE", user.id), { noSignature: true }));
    expect(res.status).toBe(400);
  });

  it("app_user_id que no corresponde a ningún User de MYS → fail-closed, no crea ni concede nada (pero responde 200 para no reintentar)", async () => {
    const res = await POST(req(makeEvent("evt_rc_unknown", "INITIAL_PURCHASE", "usuario-que-no-existe")));
    expect(res.status).toBe(200);

    const anySub = await prisma.subscriptionEvent.count({ where: { providerEventId: "evt_rc_unknown" } });
    expect(anySub).toBe(1); // el evento SÍ se guarda (auditoría), pero no se concede nada
  });

  it("evento duplicado (mismo id) se trata como ya procesado, nunca concede dos veces", async () => {
    const user = await makeUser("dup");
    const event = makeEvent("evt_rc_dup", "INITIAL_PURCHASE", user.id);

    const first = await POST(req(event));
    expect(first.status).toBe(200);
    const second = await POST(req(event));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });

    const eventsStored = await prisma.subscriptionEvent.count({ where: { providerEventId: "evt_rc_dup" } });
    expect(eventsStored).toBe(1);
  });

  it("evento fuera de orden (más antiguo que el ya aplicado) no revierte el estado", async () => {
    const user = await makeUser("out-of-order");
    const now = Date.now();

    await POST(req(makeEvent("evt_rc_ooo_new", "RENEWAL", user.id, { event_timestamp_ms: now })));
    let sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("ACTIVE");

    // Evento MÁS ANTIGUO que llega tarde, describiendo un billing issue previo.
    await POST(req(makeEvent("evt_rc_ooo_old", "BILLING_ISSUE", user.id, { event_timestamp_ms: now - 3_600_000 })));
    sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("ACTIVE"); // el evento antiguo no lo revirtió
  });

  it("RENEWAL con period_type=TRIAL marca User.hasUsedTrial=true, no se puede volver a abrir", async () => {
    const user = await makeUser("trial");
    await POST(req(makeEvent("evt_rc_trial", "INITIAL_PURCHASE", user.id, { period_type: "TRIAL" })));

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("TRIALING");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).hasUsedTrial).toBe(true);
  });

  it("Stripe y RevenueCat son independientes: cancelar RevenueCat no toca la fila STRIPE ni tumba PRO mientras Stripe siga activo", async () => {
    const user = await makeUser("independent");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "ACTIVE" },
    });
    await prisma.user.update({ where: { id: user.id }, data: { plan: "PRO" } });

    await POST(req(makeEvent("evt_rc_indep_purchase", "INITIAL_PURCHASE", user.id)));
    await POST(req(makeEvent("evt_rc_indep_expire", "EXPIRATION", user.id, { event_timestamp_ms: Date.now() + 1000 })));

    const rcSub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(rcSub.status).toBe("CANCELED");

    const stripeSub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "STRIPE" } },
    });
    expect(stripeSub.status).toBe("ACTIVE"); // el webhook de RevenueCat nunca la tocó

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO"); // Stripe lo sostiene
  });

  it("payload sin los campos obligatorios → 400", async () => {
    const body = JSON.stringify({ api_version: "1.0", event: { type: "INITIAL_PURCHASE" } });
    const res = await POST(
      new Request("http://localhost/api/revenuecat/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revenuecat-webhook-signature": sign(body) },
        body,
      })
    );
    expect(res.status).toBe(400);
  });

  it("evento no relevante para el entitlement (TEST) se reconoce y guarda pero no crea ninguna Subscription", async () => {
    const user = await makeUser("test-event");
    const res = await POST(req(makeEvent("evt_rc_test_type", "TEST", user.id)));
    expect(res.status).toBe(200);

    const sub = await prisma.subscription.findUnique({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub).toBeNull();
  });

  it("sin REVENUECAT_WEBHOOK_SECRET configurado, el endpoint responde 503 sin procesar nada", async () => {
    const original = process.env.REVENUECAT_WEBHOOK_SECRET;
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    try {
      const user = await makeUser("not-configured");
      const res = await POST(req(makeEvent("evt_rc_not_configured", "INITIAL_PURCHASE", user.id)));
      expect(res.status).toBe(503);
    } finally {
      process.env.REVENUECAT_WEBHOOK_SECRET = original;
    }
  });

  // ---- Fase 12D.1 — política de refund (cancel_reason=CUSTOMER_SUPPORT) ----

  it("A. RevenueCat ACTIVE → CANCELLATION con cancel_reason=CUSTOMER_SUPPORT (refund real) → FREE de inmediato", async () => {
    const user = await makeUser("refund-a");
    await POST(req(makeEvent("evt_rc_refund_a_purchase", "INITIAL_PURCHASE", user.id)));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");

    await POST(
      req(
        makeEvent("evt_rc_refund_a_cancel", "CANCELLATION", user.id, {
          cancel_reason: "CUSTOMER_SUPPORT",
          event_timestamp_ms: Date.now() + 1000,
        })
      )
    );

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("CANCELED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("FREE");
  });

  it("B. Stripe ACTIVE + RevenueCat ACTIVE → refund de RevenueCat → sigue PRO (Stripe lo sostiene)", async () => {
    const user = await makeUser("refund-b");
    await prisma.subscription.create({
      data: { userId: user.id, provider: "STRIPE", providerCustomerId: `cus_${user.id}`, status: "ACTIVE" },
    });
    await POST(req(makeEvent("evt_rc_refund_b_purchase", "INITIAL_PURCHASE", user.id)));
    await POST(
      req(
        makeEvent("evt_rc_refund_b_cancel", "CANCELLATION", user.id, {
          cancel_reason: "CUSTOMER_SUPPORT",
          event_timestamp_ms: Date.now() + 1000,
        })
      )
    );

    const rcSub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(rcSub.status).toBe("CANCELED"); // el refund sí se refleja en SU fila...
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO"); // ...pero Stripe lo sostiene
  });

  it("C. RevenueCat ACTIVE → CANCELLATION con cancel_reason=UNSUBSCRIBE → mantiene PRO hasta EXPIRATION", async () => {
    const user = await makeUser("refund-c");
    await POST(req(makeEvent("evt_rc_refund_c_purchase", "INITIAL_PURCHASE", user.id)));
    await POST(
      req(
        makeEvent("evt_rc_refund_c_cancel", "CANCELLATION", user.id, {
          cancel_reason: "UNSUBSCRIBE",
          event_timestamp_ms: Date.now() + 1000,
        })
      )
    );

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("ACTIVE"); // NO cambia a CANCELED todavía
    expect(sub.cancelAtPeriodEnd).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
  });

  it("D. RevenueCat ACTIVE → EXPIRATION → FREE", async () => {
    const user = await makeUser("refund-d");
    await POST(req(makeEvent("evt_rc_refund_d_purchase", "INITIAL_PURCHASE", user.id)));
    await POST(req(makeEvent("evt_rc_refund_d_expire", "EXPIRATION", user.id, { event_timestamp_ms: Date.now() + 1000 })));

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("FREE");
  });

  it("E. RevenueCat BILLING_ISSUE (evento distinto de CANCELLATION) → PAST_DUE → FREE, sin mezclarse con la lógica de refund", async () => {
    const user = await makeUser("refund-e");
    await POST(req(makeEvent("evt_rc_refund_e_purchase", "INITIAL_PURCHASE", user.id)));
    await POST(req(makeEvent("evt_rc_refund_e_billing", "BILLING_ISSUE", user.id, { event_timestamp_ms: Date.now() + 1000 })));

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("PAST_DUE");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("FREE");
  });

  it("F. out-of-order: un refund ANTIGUO no debe pisar un estado posterior más reciente", async () => {
    const user = await makeUser("refund-f");
    const now = Date.now();
    await POST(req(makeEvent("evt_rc_refund_f_purchase", "INITIAL_PURCHASE", user.id, { event_timestamp_ms: now })));
    // Renueva DESPUÉS (más reciente) — vuelve a estar ACTIVE.
    await POST(req(makeEvent("evt_rc_refund_f_renewal", "RENEWAL", user.id, { event_timestamp_ms: now + 5000 })));

    // Refund que llega tarde pero describe un instante ANTERIOR a la renovación.
    await POST(
      req(
        makeEvent("evt_rc_refund_f_late_refund", "CANCELLATION", user.id, {
          cancel_reason: "CUSTOMER_SUPPORT",
          event_timestamp_ms: now + 1000, // anterior a la renovación (now + 5000)
        })
      )
    );

    const sub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: user.id, provider: "REVENUECAT" } },
    });
    expect(sub.status).toBe("ACTIVE"); // el refund antiguo no revirtió la renovación posterior
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
  });

  it("G. webhook duplicado de refund (mismo event.id) no se procesa dos veces", async () => {
    const user = await makeUser("refund-g");
    await POST(req(makeEvent("evt_rc_refund_g_purchase", "INITIAL_PURCHASE", user.id)));

    const refundEvent = makeEvent("evt_rc_refund_g_dup", "CANCELLATION", user.id, {
      cancel_reason: "CUSTOMER_SUPPORT",
      event_timestamp_ms: Date.now() + 1000,
    });
    const first = await POST(req(refundEvent));
    expect(first.status).toBe(200);
    const second = await POST(req(refundEvent));
    expect(await second.json()).toMatchObject({ duplicate: true });

    const eventsStored = await prisma.subscriptionEvent.count({ where: { providerEventId: "evt_rc_refund_g_dup" } });
    expect(eventsStored).toBe(1);
  });

  it("TRANSFER (sin app_user_id): la cuenta origen pierde PRO y la destino lo gana", async () => {
    const from = await makeUser("transfer-from");
    const to = await makeUser("transfer-to");
    const now = Date.now();
    await POST(req(makeEvent("evt_rc_transfer_purchase", "INITIAL_PURCHASE", from.id, { event_timestamp_ms: now })));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: from.id } })).plan).toBe("PRO");

    const res = await POST(req(makeTransferEvent("evt_rc_transfer", [from.id], [to.id], now + 1000)));
    expect(res.status).toBe(200);

    const fromSub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: from.id, provider: "REVENUECAT" } },
    });
    expect(fromSub.status).toBe("CANCELED");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: from.id } })).plan).toBe("FREE");

    const toSub = await prisma.subscription.findUniqueOrThrow({
      where: { userId_provider: { userId: to.id, provider: "REVENUECAT" } },
    });
    expect(toSub.status).toBe("ACTIVE");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: to.id } })).plan).toBe("PRO");
  });

  it("TRANSFER desde un id anónimo de RevenueCat: concede a la destino y no crea ninguna fila para el origen", async () => {
    const to = await makeUser("transfer-anon-to");
    const res = await POST(req(makeTransferEvent("evt_rc_transfer_anon", ["$RCAnonymousID:abc123"], [to.id])));
    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: to.id } })).plan).toBe("PRO");
  });

  it("TRANSFER sin transferred_to → 400", async () => {
    const res = await POST(req({ id: "evt_rc_transfer_bad", type: "TRANSFER", event_timestamp_ms: Date.now() }));
    expect(res.status).toBe(400);
  });

  it("si el procesado falla, el evento se libera y el reintento de RevenueCat SÍ se procesa (no se toma por duplicado)", async () => {
    const user = await makeUser("retry-after-failure");
    const event = makeEvent("evt_rc_retry_after_failure", "INITIAL_PURCHASE", user.id);

    const spy = vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("DB caída"));
    const failed = await POST(req(event));
    spy.mockRestore();
    expect(failed.status).toBe(500);
    expect(await prisma.subscriptionEvent.count({ where: { providerEventId: "evt_rc_retry_after_failure" } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("FREE");

    const retried = await POST(req(event));
    expect(retried.status).toBe(200);
    expect(await retried.json()).not.toMatchObject({ duplicate: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).plan).toBe("PRO");
  });
});
