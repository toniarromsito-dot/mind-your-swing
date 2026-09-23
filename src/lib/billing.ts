import type { Plan } from "@prisma/client";
import { getVoiceCreditStatus, VOICE_INCLUDED_SECONDS } from "@/lib/voice/credits";

/**
 * Minutos de llamada de voz incluidos por plan — reexportado en minutos
 * (no segundos) solo para no romper a quien ya lo importaba así (p.ej. la
 * UI de ajustes). La fuente de verdad real, en segundos, vive en
 * src/lib/voice/credits.ts (Fase 11E) junto con el resto de la lógica de
 * saldo (incluidos + comprados).
 */
export const INCLUDED_VOICE_MINUTES: Record<Plan, number> = {
  FREE: VOICE_INCLUDED_SECONDS.FREE / 60,
  PRO: VOICE_INCLUDED_SECONDS.PRO / 60,
};

/**
 * ¿Puede este usuario empezar una llamada ahora? Considera el saldo TOTAL
 * disponible — incluidos + comprados (Fase 11E) — nunca solo lo incluido.
 * Esto es un guard de UX/producto, no una reserva: el consumo real y
 * definitivo se decide al registrar la duración (ver
 * tryConsumeVoiceCredit en voice/credits.ts), no aquí.
 */
export async function canStartVoiceCall(
  userId: string,
  plan: Plan
): Promise<{ allowed: boolean; minutesUsed: number; minutesIncluded: number }> {
  const status = await getVoiceCreditStatus(userId, plan);
  const totalRemainingSeconds = status.includedRemainingSeconds + status.purchasedRemainingSeconds;
  return {
    allowed: totalRemainingSeconds > 0,
    minutesUsed: (status.includedLimitSeconds - status.includedRemainingSeconds) / 60,
    minutesIncluded: status.includedLimitSeconds / 60,
  };
}
