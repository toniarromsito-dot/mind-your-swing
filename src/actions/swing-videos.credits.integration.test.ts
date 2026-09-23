import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Landmark, PoseFrame } from "@/lib/swing/scoring";
import { getSwingAiCreditStatus } from "@/lib/swing/credits";

/**
 * Fase 11D — Swing AI: 8 análisis válidos/mes, flujo completo de
 * submitSwingVideo (gate Pro → idempotencia → pose válida → consumo
 * atómico de crédito → feedback de Claude → persistencia). La mecánica
 * atómica/de periodo en sí se prueba de forma aislada en
 * src/lib/swing/credits.integration.test.ts; aquí se prueba la POLÍTICA
 * alrededor del análisis real.
 *
 * Fase 11D (cierre): el rate limit de envíos se separó explícitamente del
 * límite de créditos —
 *   - RATE LIMIT DE SEGURIDAD: 10 intentos/10min (`SUBMIT_SWING_VIDEO_RATE_LIMIT`
 *     en swing-videos.ts), protege el endpoint de abuso/ráfagas, cuenta
 *     TODO intento nuevo (válido o no), y un reintento idempotente del
 *     MISMO analysisRequestId no gasta cupo (se resuelve antes del check).
 *   - LÍMITE DE PRODUCTO: 8 análisis VÁLIDOS/mes (SwingAiCreditPeriod),
 *     independiente del rate limit — tener crédito no da más cupo de
 *     intentos, y tener cupo de intentos no da más créditos.
 * Los tests de esta sección (marcados [11D]) prueban exactamente esa
 * separación; el resto del archivo prueba la política de consumo (pose
 * inválida/error técnico/idempotencia), sin cambios de fondo en esta fase.
 * Con el límite ya en 10/10min, los bucles de hasta 10 llamadas por test
 * caben en la ventana por defecto (reseteada entre tests por el
 * `beforeEach` global de vitest.integration.setup.ts) sin necesitar ningún
 * reset manual dentro de un mismo test.
 */

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (userId ? { user: { id: userId } } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const messagesCreate = vi.fn(async () => ({ content: [{ type: "text", text: "Feedback de prueba." }] }));
vi.mock("@/lib/anthropic", () => ({
  anthropic: { messages: { create: messagesCreate } },
  COACH_MODEL: "test-model",
  COACH_MAX_TOKENS: 500,
}));

// Deja pasar cualquier poseFrames real a la implementación real de
// computeSwingMetrics, salvo el array-sentinela CRASH_FRAMES, que fuerza un
// error genérico (no InsufficientPoseDataError) — es la única forma
// fiable de ejercer la rama de "error técnico" sin depender de que la
// heurística real de pose-estimation falle de forma orgánica.
const CRASH_FRAMES: PoseFrame[] = [{ t: -1, landmarks: [] }];
vi.mock("@/lib/swing/scoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/swing/scoring")>();
  return {
    ...actual,
    computeSwingMetrics: (frames: PoseFrame[]) => {
      if (frames === CRASH_FRAMES) throw new Error("fallo técnico simulado");
      return actual.computeSwingMetrics(frames);
    },
  };
});

const { submitSwingVideo } = await import("@/actions/swing-videos");

function makeLandmarks(): Landmark[] {
  const arr: Landmark[] = new Array(29).fill({ x: 0.5, y: 0.5, visibility: 1 });
  arr[0] = { x: 0.5, y: 0.2, visibility: 1 }; // nariz
  arr[11] = { x: 0.45, y: 0.3, visibility: 1 }; // hombro izq
  arr[12] = { x: 0.55, y: 0.3, visibility: 1 }; // hombro der
  arr[13] = { x: 0.4, y: 0.35, visibility: 1 };
  arr[14] = { x: 0.6, y: 0.35, visibility: 1 };
  arr[15] = { x: 0.38, y: 0.4, visibility: 1 }; // muñeca izq
  arr[16] = { x: 0.62, y: 0.4, visibility: 1 }; // muñeca der
  arr[23] = { x: 0.47, y: 0.55, visibility: 1 }; // cadera izq
  arr[24] = { x: 0.53, y: 0.55, visibility: 1 }; // cadera der
  arr[25] = { x: 0.46, y: 0.7, visibility: 1 };
  arr[26] = { x: 0.54, y: 0.7, visibility: 1 };
  arr[27] = { x: 0.46, y: 0.9, visibility: 1 }; // tobillo izq
  arr[28] = { x: 0.54, y: 0.9, visibility: 1 }; // tobillo der
  return arr;
}

function validPoseFrames(count = 12): PoseFrame[] {
  return Array.from({ length: count }, (_, i) => ({ t: i * 33, landmarks: makeLandmarks() }));
}

describe("submitSwingVideo — créditos de Swing AI, 8 análisis/mes (integración, DB real)", () => {
  const userIds: string[] = [];
  let idSeq = 0;
  const nextId = () => `req-${Date.now()}-${idSeq++}`;

  async function makeUser(label: string, plan: "FREE" | "PRO" = "PRO") {
    const user = await prisma.user.create({
      data: { email: `swing-e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`, plan },
    });
    userIds.push(user.id);
    return user;
  }

  afterEach(() => {
    userId = "";
    messagesCreate.mockClear();
  });

  afterAll(async () => {
    await prisma.swingVideo.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.swingAiCreditPeriod.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("1. FREE → 0 análisis: rechazado antes de tocar créditos o llamar a Claude", async () => {
    const free = await makeUser("free", "FREE");
    userId = free.id;

    const result = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: nextId(),
    });

    expect("error" in result).toBe(true);
    expect(messagesCreate).not.toHaveBeenCalled();
    const periodRow = await prisma.swingAiCreditPeriod.findFirst({ where: { userId: free.id } });
    expect(periodRow).toBeNull(); // el sistema de créditos ni se ha tocado
  });

  it("2. PRO → 8 análisis: puede completar sus 8 análisis válidos EN UNA SOLA SESIÓN (rate limit 10/10min ya no lo impide)", async () => {
    const pro = await makeUser("eight-valid");
    userId = pro.id;

    // Fase 11D (cierre): sin resetRateLimitsForTests() entre llamadas a
    // propósito — con el rate limit ya en 10/10min, los 8 análisis caben
    // de sobra en una sola ventana. Antes de este cierre esto exigía
    // resetear el rate limit manualmente porque 8 > 5 chocaba con el
    // límite viejo; ese era justo el hallazgo que se cierra en esta fase.
    for (let i = 0; i < 8; i++) {
      const result = await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: validPoseFrames(),
        analysisRequestId: nextId(),
      });
      expect("error" in result).toBe(false);
    }

    const status = await getSwingAiCreditStatus(pro.id);
    expect(status.used).toBe(8);
    expect(status.remaining).toBe(0);
  });

  it("5. noveno análisis → rechazado por el límite de CRÉDITOS específicamente, no por el rate limit (que todavía tiene cupo)", async () => {
    const pro = await makeUser("ninth-rejected");
    userId = pro.id;

    for (let i = 0; i < 8; i++) {
      await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: validPoseFrames(),
        analysisRequestId: nextId(),
      });
    }
    messagesCreate.mockClear();

    const ninth = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: nextId(),
    });

    expect("error" in ninth).toBe(true);
    if ("error" in ninth) {
      expect(ninth.error).toMatch(/8 análisis/i); // mensaje de crédito, NO el de rate limit
      expect(ninth.error).not.toMatch(/rápido/i); // ese es el texto del rate limit
    }
    expect(messagesCreate).not.toHaveBeenCalled(); // rechazado antes del paso costoso
    const status = await getSwingAiCreditStatus(pro.id);
    expect(status.used).toBe(8); // el intento rechazado no se contó
  });

  it("6. pose inválida → no consume crédito", async () => {
    const pro = await makeUser("invalid-pose");
    userId = pro.id;

    const result = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: [], // menos del mínimo de fotogramas fiables
      analysisRequestId: nextId(),
    });

    expect("error" in result).toBe(true);
    const status = await getSwingAiCreditStatus(pro.id);
    expect(status.used).toBe(0);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("7. error técnico (tras pasar la validación de pose) → no consume crédito", async () => {
    const pro = await makeUser("technical-error");
    userId = pro.id;

    const result = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: CRASH_FRAMES,
      analysisRequestId: nextId(),
    });

    expect("error" in result).toBe(true);
    const status = await getSwingAiCreditStatus(pro.id);
    expect(status.used).toBe(0); // el fallo ocurre antes de consumir, ver submitSwingVideo
  });

  it("8/17. retry del mismo analysisRequestId tras completarse → idempotente, no consume un segundo crédito", async () => {
    const pro = await makeUser("retry-same-id");
    userId = pro.id;
    const id = nextId();

    const first = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: id,
    });
    expect("error" in first).toBe(false);

    const statusAfterFirst = await getSwingAiCreditStatus(pro.id);
    expect(statusAfterFirst.used).toBe(1);

    const retry = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: id, // MISMO id — reintento técnico
    });
    expect("error" in retry).toBe(false);
    if (!("error" in first) && !("error" in retry)) {
      expect(retry.id).toBe(first.id); // mismo análisis, no uno nuevo
    }

    const statusAfterRetry = await getSwingAiCreditStatus(pro.id);
    expect(statusAfterRetry.used).toBe(1); // sigue en 1, el reintento no sumó otro

    const rows = await prisma.swingVideo.count({ where: { userId: pro.id } });
    expect(rows).toBe(1); // nunca se creó una segunda fila
  });

  it("9. un nuevo análisis (analysisRequestId distinto) sí consume su propio crédito", async () => {
    const pro = await makeUser("new-analysis");
    userId = pro.id;

    await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: nextId(),
    });
    await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: nextId(),
    });

    const status = await getSwingAiCreditStatus(pro.id);
    expect(status.used).toBe(2);
  });

  it("13. un usuario FREE no puede consumir crédito aunque envíe datos válidos manipulando el frontend", async () => {
    const free = await makeUser("free-cant-manipulate", "FREE");
    userId = free.id;

    // Pose perfectamente válida y hasta un campo extra que no existe en el
    // tipo (simulando una request fabricada a mano) — el gate Pro corta
    // antes de que nada de esto importe.
    await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: nextId(),
      // @ts-expect-error — campo fabricado que no existe en el tipo real, para simular un cliente manipulado
      consumed: 0,
    });

    const status = await getSwingAiCreditStatus(free.id);
    expect(status.used).toBe(0);
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("dos requests REALMENTE concurrentes con el mismo analysisRequestId consumen un único crédito, no dos", async () => {
    const pro = await makeUser("concurrent-same-id");
    userId = pro.id;
    const id = nextId();

    const [a, b] = await Promise.all([
      submitSwingVideo({ videoUrl: "https://example.com/swing.mp4", poseFrames: validPoseFrames(), analysisRequestId: id }),
      submitSwingVideo({ videoUrl: "https://example.com/swing.mp4", poseFrames: validPoseFrames(), analysisRequestId: id }),
    ]);

    expect("error" in a).toBe(false);
    expect("error" in b).toBe(false);
    if (!("error" in a) && !("error" in b)) {
      expect(a.id).toBe(b.id); // las dos ven el mismo análisis "ganador"
    }

    const status = await getSwingAiCreditStatus(pro.id);
    expect(status.used).toBe(1); // nunca 2, pese a la carrera real

    const rows = await prisma.swingVideo.count({ where: { userId: pro.id, analysisRequestId: id } });
    expect(rows).toBe(1);
  });

  it("15. el contador de créditos ignora cualquier campo enviado desde el cliente que no sea el real analysisRequestId", async () => {
    const pro = await makeUser("cant-manipulate-counter");
    userId = pro.id;

    await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: nextId(),
      // @ts-expect-error — intento de manipular el contador directamente desde el "cliente"
      creditsRemaining: 999,
    });

    const status = await getSwingAiCreditStatus(pro.id);
    expect(status.used).toBe(1); // el servidor calculó el consumo real, ignorando el campo fabricado
  });

  // ---- Fase 11D (cierre): rate limit de seguridad (10/10min) vs límite de producto (8/mes) ----

  it("[11D-1] Swing AI permite hasta 10 intentos en 10 minutos", async () => {
    const pro = await makeUser("ten-attempts-allowed");
    userId = pro.id;

    for (let i = 0; i < 10; i++) {
      const result = await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: [], // pose inválida a propósito: solo interesa el rate limit, no gastar crédito
        analysisRequestId: nextId(),
      });
      expect("error" in result ? result.error : "").toMatch(/fotogramas/i); // ninguno rechazado por rate limit
    }
  });

  it("[11D-2] el intento número 11 dentro de la ventana es rechazado por rate limit", async () => {
    const pro = await makeUser("eleventh-rejected");
    userId = pro.id;

    for (let i = 0; i < 10; i++) {
      await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: [],
        analysisRequestId: nextId(),
      });
    }

    const eleventh = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: [],
      analysisRequestId: nextId(),
    });
    expect("error" in eleventh).toBe(true);
    if ("error" in eleventh) {
      expect(eleventh.error).toMatch(/rápido/i);
    }
  });

  it("[11D-3] tener los 8 créditos intactos no concede más de 10 intentos/10min — el rate limit es independiente del saldo", async () => {
    const pro = await makeUser("credits-dont-extend-ratelimit");
    userId = pro.id;

    // 10 intentos con pose inválida: nunca tocan crédito (los 8 siguen
    // disponibles), pero SÍ cuentan contra el rate limit de seguridad.
    for (let i = 0; i < 10; i++) {
      await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: [],
        analysisRequestId: nextId(),
      });
    }
    const statusBeforeEleventh = await getSwingAiCreditStatus(pro.id);
    expect(statusBeforeEleventh.remaining).toBe(8); // ningún crédito tocado

    const eleventh = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(), // esta vez pose VÁLIDA — daría igual, el rate limit corta antes
      analysisRequestId: nextId(),
    });
    expect("error" in eleventh).toBe(true);
    if ("error" in eleventh) {
      expect(eleventh.error).toMatch(/rápido/i); // rechazado por rate limit, no por falta de crédito
    }
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  it("[11D-6] pose inválida sigue consumiendo 0 créditos, pero SÍ cuenta contra el rate limit de seguridad", async () => {
    const pro = await makeUser("invalid-pose-counts-ratelimit");
    userId = pro.id;

    for (let i = 0; i < 3; i++) {
      await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: [],
        analysisRequestId: nextId(),
      });
    }
    expect((await getSwingAiCreditStatus(pro.id)).used).toBe(0); // créditos intactos

    // Quedan 7 intentos de cupo de rate limit (10 - 3): 7 análisis VÁLIDOS
    // más deberían caber justo antes de que el rate limit corte.
    for (let i = 0; i < 7; i++) {
      const result = await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: validPoseFrames(),
        analysisRequestId: nextId(),
      });
      expect("error" in result).toBe(false);
    }
    const eleventh = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: nextId(),
    });
    expect("error" in eleventh).toBe(true);
    if ("error" in eleventh) {
      expect(eleventh.error).toMatch(/rápido/i); // el 11º intento total, sea cual sea su pose, cae en rate limit
    }
  });

  it("[11D-7] un retry del mismo analysisRequestId ya completado NO gasta cupo de rate limit", async () => {
    const pro = await makeUser("retry-skips-ratelimit");
    userId = pro.id;
    const id = nextId();

    const first = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: id,
    });
    expect("error" in first).toBe(false);

    // Agota los 10 intentos "nuevos" restantes del rate limit (ya se gastó
    // 1 con el análisis anterior).
    for (let i = 0; i < 9; i++) {
      await submitSwingVideo({
        videoUrl: "https://example.com/swing.mp4",
        poseFrames: [],
        analysisRequestId: nextId(),
      });
    }
    // El rate limit ya está agotado — un intento NUEVO se rechazaría aquí.
    const blocked = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: [],
      analysisRequestId: nextId(),
    });
    expect("error" in blocked).toBe(true);
    if ("error" in blocked) expect(blocked.error).toMatch(/rápido/i);

    // Pero un RETRY del análisis YA completado (mismo id de antes) sigue
    // funcionando: la idempotencia se resuelve antes de tocar el rate limit.
    const retry = await submitSwingVideo({
      videoUrl: "https://example.com/swing.mp4",
      poseFrames: validPoseFrames(),
      analysisRequestId: id,
    });
    expect("error" in retry).toBe(false);
    if (!("error" in first) && !("error" in retry)) {
      expect(retry.id).toBe(first.id);
    }
  });
});
