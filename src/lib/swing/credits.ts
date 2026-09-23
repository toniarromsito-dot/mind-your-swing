import { prisma } from "@/lib/prisma";

/**
 * Créditos de Swing AI — Fase 11D. 8 análisis válidos por mes, PRO
 * únicamente. El periodo es el mes natural ("YYYY-MM"), no el ciclo exacto
 * de facturación de Stripe — misma simplificación ya usada y documentada
 * para los minutos de Voice (ver getBillingPeriodStart en billing.ts) y
 * para el reto mensual de Comunidad (currentChallengeMonth en
 * data/social.ts). Se elige a propósito: desacopla el crédito de si la
 * suscripción es mensual o anual, de si está en trial, o de cuándo canceló
 * y volvió — todo eso ya lo resuelve hasProAccess()/canUseFeature() antes
 * de llegar aquí; esta capa solo cuenta cuántos análisis caben en el mes
 * de calendario en curso.
 */
export const SWING_AI_MONTHLY_LIMIT = 8;

export function currentSwingAiPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export type SwingAiCreditStatus = { used: number; remaining: number; limit: number; period: string };

export async function getSwingAiCreditStatus(userId: string): Promise<SwingAiCreditStatus> {
  const period = currentSwingAiPeriod();
  const row = await prisma.swingAiCreditPeriod.findUnique({ where: { userId_period: { userId, period } } });
  const used = row?.consumed ?? 0;
  return { used, remaining: Math.max(0, SWING_AI_MONTHLY_LIMIT - used), limit: SWING_AI_MONTHLY_LIMIT, period };
}

/**
 * Ya existe un análisis completado con este analysisRequestId — el camino
 * rápido para un reintento técnico secuencial (la respuesta del primer
 * intento se perdió en el cliente, pero el servidor ya lo procesó). No es
 * la única defensa: el UNIQUE de SwingVideo.analysisRequestId es lo que de
 * verdad impide un doble consumo si dos requests con el mismo id llegan de
 * verdad en paralelo (ver submitSwingVideo).
 */
export async function findCompletedAnalysisByRequestId(userId: string, analysisRequestId: string) {
  return prisma.swingVideo.findFirst({ where: { userId, analysisRequestId } });
}

/**
 * Escritura condicional atómica: el chequeo "¿queda crédito?" y la
 * escritura son la MISMA sentencia UPDATE (`consumed` en el WHERE), no un
 * read-then-write separado — así dos requests concurrentes del mismo
 * usuario con 1 crédito restante no pueden consumirlo las dos. Postgres
 * serializa las escrituras a la misma fila (userId, period): la segunda ve
 * siempre el `consumed` ya incrementado por la primera en el momento de
 * evaluar su propio WHERE, nunca un valor obsoleto.
 */
export async function tryConsumeSwingAiCredit(
  userId: string
): Promise<{ ok: true; status: SwingAiCreditStatus } | { ok: false; status: SwingAiCreditStatus }> {
  const period = currentSwingAiPeriod();

  await prisma.swingAiCreditPeriod.upsert({
    where: { userId_period: { userId, period } },
    update: {},
    create: { userId, period, consumed: 0 },
  });

  const applied = await prisma.swingAiCreditPeriod.updateMany({
    where: { userId, period, consumed: { lt: SWING_AI_MONTHLY_LIMIT } },
    data: { consumed: { increment: 1 } },
  });

  const status = await getSwingAiCreditStatus(userId);
  return applied.count === 1 ? { ok: true, status } : { ok: false, status };
}

/**
 * Compensación (no una "reserva" separada): se llama solo cuando un
 * crédito YA consumido con tryConsumeSwingAiCredit debe devolverse porque,
 * tras consumirlo, el análisis falló por un motivo técnico real (nunca por
 * pose inválida — eso se comprueba ANTES de consumir, ver
 * submitSwingVideo) o porque perdimos la carrera de idempotencia contra
 * otra request con el mismo analysisRequestId. También usa una escritura
 * condicional (`consumed > 0`) para no poder dejarlo negativo.
 */
export async function releaseSwingAiCredit(userId: string): Promise<void> {
  const period = currentSwingAiPeriod();
  await prisma.swingAiCreditPeriod.updateMany({
    where: { userId, period, consumed: { gt: 0 } },
    data: { consumed: { decrement: 1 } },
  });
}
