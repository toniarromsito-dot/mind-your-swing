"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { hasProAccess } from "@/lib/plan";
import { getCurrentLocale } from "@/lib/i18n/current-locale";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { computeSwingMetrics, InsufficientPoseDataError, type PoseFrame } from "@/lib/swing/scoring";
import { generateSwingFeedback } from "@/lib/swing/feedback";

export type SubmitSwingVideoResult = { error: string } | { id: string; score: number; aiFeedback: string };

/**
 * Recibe el vídeo ya subido (URL de Vercel Blob) y los keypoints de pose
 * extraídos en el cliente (nunca el vídeo/frames en sí). Calcula la
 * puntuación aquí (misma heurística pura que en el cliente, recalculada
 * en el servidor para no confiar en un número que mande el navegador) y
 * genera el feedback en lenguaje natural con Claude.
 */
export async function submitSwingVideo(input: {
  videoUrl: string;
  note?: string;
  poseFrames: PoseFrame[];
}): Promise<SubmitSwingVideoResult> {
  const locale = await getCurrentLocale();
  const t = dictionaries[locale].swingVideos;

  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!hasProAccess(user)) {
    return { error: t.proRequiredError };
  }

  let metrics;
  try {
    metrics = computeSwingMetrics(input.poseFrames);
  } catch (err) {
    if (err instanceof InsufficientPoseDataError) return { error: err.message };
    return { error: t.genericError };
  }

  let aiFeedback: string;
  try {
    aiFeedback = await generateSwingFeedback(metrics, locale);
  } catch {
    aiFeedback = "";
  }

  const video = await prisma.swingVideo.create({
    data: {
      userId: user.id,
      videoUrl: input.videoUrl,
      note: input.note?.trim() || null,
      score: metrics.overallScore,
      metrics: metrics as unknown as object,
      aiFeedback: aiFeedback || null,
    },
  });

  revalidatePath("/coach/videos");
  return { id: video.id, score: metrics.overallScore, aiFeedback };
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
  revalidatePath("/coach/videos");
  return { ok: true };
}
