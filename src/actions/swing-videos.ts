"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { canUseFeature } from "@/lib/entitlements";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import { computeSwingMetrics, InsufficientPoseDataError, type PoseFrame } from "@/lib/swing/scoring";
import { generateSwingFeedback } from "@/lib/swing/feedback";
import {
  findCompletedAnalysisByRequestId,
  getSwingAiCreditStatus,
  releaseSwingAiCredit,
  SWING_AI_MONTHLY_LIMIT,
  tryConsumeSwingAiCredit,
} from "@/lib/swing/credits";

export type SubmitSwingVideoResult =
  | { error: string }
  | { id: string; score: number; aiFeedback: string; creditsRemaining: number };

// Fase 11D: dos límites distintos, a propósito nunca mezclados.
//
//   LÍMITE DE PRODUCTO (créditos, ver credits.ts) — 8 análisis VÁLIDOS al
//   mes. Controla cuánto puede "gastar" un Pro; vive en SwingAiCreditPeriod.
//
//   RATE LIMIT DE SEGURIDAD (este) — 10 intentos de envío cada 10 minutos,
//   válidos o no. Protege el endpoint de abuso/ráfagas (cada intento, si
//   pasa de pose inválida, dispara una llamada real a Claude); no
//   representa ni resta créditos de producto. Un usuario con crédito
//   sobrado sigue limitado a 10 intentos/10min; agotar los 8 créditos
//   nunca "libera" más cupo de rate limit, y viceversa.
const SUBMIT_SWING_VIDEO_RATE_LIMIT = { windowMs: 10 * 60_000, maxRequests: 10 };

/**
 * Recibe el vídeo ya subido (URL de Vercel Blob), los keypoints de pose
 * extraídos en el cliente (nunca el vídeo/frames en sí) y un
 * `analysisRequestId` generado por el cliente una vez por intento de
 * análisis (ver swing-video-uploader.tsx). Calcula la puntuación aquí
 * (misma heurística pura que en el cliente, recalculada en el servidor
 * para no confiar en un número que mande el navegador), consume 1 de los
 * 8 créditos mensuales de Swing AI (Fase 11D) y genera el feedback en
 * lenguaje natural con Claude.
 *
 * Orden deliberado — nunca se ejecuta trabajo costoso antes de comprobar
 * entitlement/crédito, y un reintento idempotente nunca gasta cupo de
 * rate limit (Fase 11D):
 *  1. autenticación + Pro (gratis)
 *  2. idempotencia: ¿este analysisRequestId ya se completó? (gratis,
 *     ANTES del rate limit — un reintento del mismo análisis no cuenta
 *     como un intento nuevo para la protección de abuso)
 *  3. rate limit de seguridad (10/10min) — solo para intentos que de
 *     verdad son nuevos/incompletos
 *  4. pose válida (cálculo local, sin coste externo)
 *  5. crédito disponible — consumo ATÓMICO (ver credits.ts)
 *  6. feedback de Claude (el único paso realmente costoso) — ya ocurre
 *     DESPUÉS de haber consumido el crédito
 *  7. persistir el resultado
 */
export async function submitSwingVideo(input: {
  videoUrl: string;
  note?: string;
  poseFrames: PoseFrame[];
  analysisRequestId: string;
}): Promise<SubmitSwingVideoResult> {
  const locale = await getCurrentLocale();
  const t = dictionaries[locale].swingVideos;

  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  if (!input.analysisRequestId || input.analysisRequestId.length > 200) {
    return { error: t.genericError };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!canUseFeature(user, "SWING_AI")) {
    return { error: t.proRequiredError };
  }

  // Idempotencia — camino rápido, ANTES del rate limit: un reintento
  // técnico secuencial del mismo analysisRequestId (la respuesta del
  // primer intento se perdió antes de llegar al cliente, pero el servidor
  // ya lo había completado) devuelve el resultado ya guardado sin tocar
  // créditos NI gastar cupo de rate limit — no es un "intento" nuevo para
  // la protección de abuso, es la misma request de siempre.
  const alreadyCompleted = await findCompletedAnalysisByRequestId(user.id, input.analysisRequestId);
  if (alreadyCompleted) {
    const status = await getSwingAiCreditStatus(user.id);
    return {
      id: alreadyCompleted.id,
      score: alreadyCompleted.score ?? 0,
      aiFeedback: alreadyCompleted.aiFeedback ?? "",
      creditsRemaining: status.remaining,
    };
  }

  // A partir de aquí es un intento genuinamente nuevo o incompleto (pose
  // inválida en un intento anterior con este mismo id, por ejemplo) — sí
  // cuenta contra el rate limit de seguridad, precisamente porque cada uno
  // de estos intentos puede disparar trabajo real (Claude) si la pose
  // resulta válida.
  const rl = checkRateLimit(`swing-video-submit:${session.user.id}`, SUBMIT_SWING_VIDEO_RATE_LIMIT);
  if (!rl.allowed) {
    return { error: t.rateLimitError };
  }

  let metrics;
  try {
    metrics = computeSwingMetrics(input.poseFrames);
  } catch (err) {
    if (err instanceof InsufficientPoseDataError) return { error: err.message };
    return { error: t.genericError };
  }

  const consumption = await tryConsumeSwingAiCredit(user.id);
  if (!consumption.ok) {
    return { error: fmt(t.creditsLimitError, { limit: SWING_AI_MONTHLY_LIMIT }) };
  }

  let aiFeedback: string;
  try {
    aiFeedback = await generateSwingFeedback(metrics, locale);
  } catch {
    aiFeedback = "";
  }

  try {
    const video = await prisma.swingVideo.create({
      data: {
        userId: user.id,
        videoUrl: input.videoUrl,
        note: input.note?.trim() || null,
        score: metrics.overallScore,
        metrics: metrics as unknown as object,
        aiFeedback: aiFeedback || null,
        analysisRequestId: input.analysisRequestId,
      },
    });

    revalidatePath("/aprende/videos");
    const status = await getSwingAiCreditStatus(user.id);
    return { id: video.id, score: metrics.overallScore, aiFeedback, creditsRemaining: status.remaining };
  } catch (err) {
    // Perdimos la carrera de idempotencia: otra request concurrente con el
    // MISMO analysisRequestId ya insertó su fila primero. El crédito que
    // acabamos de consumir se libera — el ganador ya consumió el suyo — y
    // devolvemos el resultado real, nunca un error, para que este cliente
    // vea exactamente el mismo análisis que "ganó".
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await releaseSwingAiCredit(user.id);
      const winner = await findCompletedAnalysisByRequestId(user.id, input.analysisRequestId);
      if (winner) {
        const status = await getSwingAiCreditStatus(user.id);
        return {
          id: winner.id,
          score: winner.score ?? 0,
          aiFeedback: winner.aiFeedback ?? "",
          creditsRemaining: status.remaining,
        };
      }
    }
    // Fallo técnico real tras haber consumido el crédito (p.ej. la propia
    // escritura de SwingVideo falla) — se libera, nunca se cobra un
    // análisis que no llegó a guardarse.
    await releaseSwingAiCredit(user.id);
    return { error: t.genericError };
  }
}

export async function submitManualFeedback(
  videoId: string,
  feedback: string
): Promise<{ error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return { error: "No autorizado" };
  }

  const trimmed = feedback.trim();
  if (!trimmed) return { error: "Escribe un feedback antes de guardarlo." };

  await prisma.swingVideo.update({
    where: { id: videoId },
    data: { feedback: trimmed, status: "REVIEWED", reviewedAt: new Date() },
  });

  revalidatePath("/admin/videos");
  revalidatePath("/aprende/videos");
  return { ok: true };
}
