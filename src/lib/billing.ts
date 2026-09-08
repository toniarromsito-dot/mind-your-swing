import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Minutos de llamada de voz incluidos por plan y por periodo. El periodo
 * se aproxima al mes natural (no al ciclo exacto de facturación de Stripe)
 * para no depender de una llamada extra a Stripe en cada chequeo — una
 * simplificación razonable para el volumen de esta app.
 */
export const INCLUDED_VOICE_MINUTES: Record<Plan, number> = {
  FREE: 5,
  PRO: 40,
};

export function getBillingPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getVoiceMinutesUsedThisPeriod(userId: string): Promise<number> {
  const periodStart = getBillingPeriodStart();
  const result = await prisma.voiceCallLog.aggregate({
    where: { userId, createdAt: { gte: periodStart } },
    _sum: { durationSeconds: true },
  });
  return (result._sum.durationSeconds ?? 0) / 60;
}

export async function canStartVoiceCall(
  userId: string,
  plan: Plan
): Promise<{ allowed: boolean; minutesUsed: number; minutesIncluded: number }> {
  const minutesUsed = await getVoiceMinutesUsedThisPeriod(userId);
  const minutesIncluded = INCLUDED_VOICE_MINUTES[plan];
  return { allowed: minutesUsed < minutesIncluded, minutesUsed, minutesIncluded };
}
