import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Créditos de Voice — Fase 11E. Dos saldos SIEMPRE separados y NUNCA
 * mezclados:
 *
 *   INCLUDED  — minutos del plan, por periodo natural ("YYYY-MM", mismo
 *   patrón que SwingAiCreditPeriod). Se reinician solos: cada periodo nuevo
 *   se crea bajo demanda, nunca por cron, nunca borrando el anterior.
 *
 *   PURCHASED — minutos de packs comprados (Stripe, compra única). Nunca
 *   caducan, nunca se reinician, sobreviven a cualquier cambio de mes.
 *
 * Orden de consumo, siempre: included primero: solo cuando included llega
 * a 0 se toca purchased. Si la duración real supera included+purchased, el
 * exceso se absorbe — nunca se genera deuda, nunca queda saldo negativo,
 * nunca hay cobro ni compensación automática posterior (decisión de
 * producto ya cerrada).
 *
 * Todo el módulo trabaja internamente en SEGUNDOS, sin redondear nunca el
 * consumo — la conversión a minutos es responsabilidad exclusiva de la UI.
 *
 * Límite de confianza (hardening, sección 37): `conversationId` es UNSTRUSTED
 * en cuanto a contenido — lo genera el cliente (conversation.getId() del SDK
 * de ElevenLabs) y viaja en el body de una request normal, así que nada
 * impide a un cliente hostil enviar un id inventado o repetir uno ajeno.
 * NO es prueba criptográfica de que la llamada ocurrió ni de su duración —
 * es únicamente la CLAVE DE IDEMPOTENCIA que decide "¿ya procesé este
 * conversationId antes?". La autoridad real sigue siendo el servidor: quién
 * puede llamar a tryConsumeVoiceCredit (siempre `userId` de la sesión,
 * nunca del body) y cuánto se descuenta (siempre acotado al saldo real en
 * DB, nunca lo que diga el cliente). Ver también la limitación conocida y
 * ya aceptada de que la DURACIÓN reportada es autoreportada por el cliente
 * — el webhook autoritativo de ElevenLabs es una fase posterior.
 */

export const VOICE_INCLUDED_SECONDS: Record<Plan, number> = {
  FREE: 5 * 60,
  PRO: 40 * 60,
};

/** Tamaño del pack — 60 minutos exactos, siempre en segundos, nunca en decimal. */
export const VOICE_PACK_SECONDS = 60 * 60;

export function currentVoicePeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export type VoiceCreditStatus = {
  includedRemainingSeconds: number;
  includedLimitSeconds: number;
  purchasedRemainingSeconds: number;
  period: string;
};

export async function getVoiceCreditStatus(userId: string, plan: Plan): Promise<VoiceCreditStatus> {
  const period = currentVoicePeriod();
  const limit = VOICE_INCLUDED_SECONDS[plan];

  const [periodRow, purchasedRow] = await Promise.all([
    prisma.voiceCreditPeriod.findUnique({ where: { userId_period: { userId, period } } }),
    prisma.voicePurchasedBalance.findUnique({ where: { userId } }),
  ]);

  return {
    includedRemainingSeconds: Math.max(0, limit - (periodRow?.consumedSeconds ?? 0)),
    includedLimitSeconds: limit,
    purchasedRemainingSeconds: purchasedRow?.remainingSeconds ?? 0,
    period,
  };
}

export type ConsumeVoiceCreditResult = {
  /** Idempotente: true si esta llamada YA se había procesado antes (mismo conversationId) — no se ha vuelto a descontar nada. */
  idempotent: boolean;
  fromIncludedSeconds: number;
  fromPurchasedSeconds: number;
  /** Segundos de esta llamada que excedieron el saldo disponible y se absorbieron (ver sección 49). */
  excessSeconds: number;
  status: VoiceCreditStatus;
};

/**
 * Consumo atómico. A diferencia de los créditos de Swing AI (todo o nada,
 * un booleano), aquí la llamada YA ha ocurrido — nunca se "rechaza": se
 * reconcilia cuánto de esa llamada cuenta contra el saldo disponible. Si
 * el saldo no alcanza, se descuenta lo que haya y el resto se absorbe.
 *
 * Cierre de la carrera de concurrencia — pedido explícitamente en la
 * especificación: un simple `if (exists) return` NO basta, porque dos
 * requests con el mismo conversationId pueden pasar ese chequeo a la vez.
 * La garantía real viene de dos mecanismos combinados, ambos a nivel de
 * Postgres:
 *
 *  1. `SELECT ... FOR UPDATE` sobre las filas de VoiceCreditPeriod y
 *     VoicePurchasedBalance, dentro de una transacción — Postgres serializa
 *     cualquier otra transacción que intente tocar esas MISMAS filas hasta
 *     que esta termine (commit o rollback). Así, si dos llamadas DISTINTAS
 *     (conversationId distinto) intentan consumir más de lo que queda al
 *     mismo tiempo, la segunda ve el saldo YA actualizado por la primera
 *     cuando por fin puede leer — nunca un valor obsoleto.
 *
 *  2. El INSERT de VoiceCallLog (con `conversationId` UNIQUE) vive DENTRO
 *     de esa misma transacción. Si dos requests con el MISMO conversationId
 *     compiten de verdad, la segunda consigue el lock, recalcula sobre el
 *     saldo ya actualizado por la primera, pero su propio INSERT choca con
 *     la restricción UNIQUE — Postgres revierte la transacción COMPLETA
 *     (incluidos los updates de saldo que acababa de hacer), así que su
 *     "consumo fantasma" nunca llega a persistir. No hace falta ninguna
 *     compensación manual: el rollback ya lo deshace todo.
 */
export async function tryConsumeVoiceCredit(
  userId: string,
  plan: Plan,
  durationSeconds: number,
  conversationId: string
): Promise<ConsumeVoiceCreditResult> {
  // Camino rápido — reintento secuencial normal (la respuesta del primer
  // intento se perdió antes de llegar al cliente, pero el servidor ya lo
  // había procesado). No es la protección real contra la carrera (esa es
  // el UNIQUE + la transacción de abajo), solo evita recalcular sin falta.
  const existing = await prisma.voiceCallLog.findUnique({ where: { conversationId } });
  if (existing) {
    return {
      idempotent: true,
      fromIncludedSeconds: 0,
      fromPurchasedSeconds: 0,
      excessSeconds: 0,
      status: await getVoiceCreditStatus(userId, plan),
    };
  }

  const period = currentVoicePeriod();
  const limit = VOICE_INCLUDED_SECONDS[plan];

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.voiceCreditPeriod.upsert({
        where: { userId_period: { userId, period } },
        update: {},
        create: { userId, period, consumedSeconds: 0 },
      });
      await tx.voicePurchasedBalance.upsert({
        where: { userId },
        update: {},
        create: { userId, remainingSeconds: 0 },
      });

      // FOR UPDATE: bloquea estas dos filas hasta que la transacción termine.
      const [periodRow] = await tx.$queryRaw<{ consumedSeconds: number }[]>`
        SELECT "consumedSeconds" FROM "VoiceCreditPeriod"
        WHERE "userId" = ${userId} AND "period" = ${period}
        FOR UPDATE
      `;
      const [purchasedRow] = await tx.$queryRaw<{ remainingSeconds: number }[]>`
        SELECT "remainingSeconds" FROM "VoicePurchasedBalance"
        WHERE "userId" = ${userId}
        FOR UPDATE
      `;

      const includedRemaining = Math.max(0, limit - periodRow.consumedSeconds);
      const fromIncluded = Math.min(durationSeconds, includedRemaining);
      const remainderAfterIncluded = durationSeconds - fromIncluded;
      const fromPurchased = Math.min(remainderAfterIncluded, purchasedRow.remainingSeconds);
      // El resto (remainderAfterIncluded - fromPurchased), si lo hay, es el
      // exceso — se absorbe: nunca genera deuda, nunca deja saldo negativo,
      // nunca se convierte en un cobro automático. Sección 49 (hardening):
      // se hace OBSERVABLE (excessSeconds en VoiceCallLog + warn), pero
      // deliberadamente no se usa para reconstruir ningún saldo — es un
      // hecho descriptivo de esta llamada, no un ledger.
      const excess = remainderAfterIncluded - fromPurchased;

      if (fromIncluded > 0) {
        await tx.voiceCreditPeriod.update({
          where: { userId_period: { userId, period } },
          data: { consumedSeconds: { increment: fromIncluded } },
        });
      }
      if (fromPurchased > 0) {
        await tx.voicePurchasedBalance.update({
          where: { userId },
          data: { remainingSeconds: { decrement: fromPurchased } },
        });
      }

      await tx.voiceCallLog.create({
        data: { userId, durationSeconds, conversationId, excessSeconds: excess },
      });

      return { fromIncluded, fromPurchased, excess };
    });

    if (result.excess > 0) {
      console.warn(
        `Voice: llamada ${conversationId} del usuario ${userId} superó el saldo disponible en ${result.excess}s — absorbido, sin deuda ni saldo negativo.`
      );
    }

    return {
      idempotent: false,
      fromIncludedSeconds: result.fromIncluded,
      fromPurchasedSeconds: result.fromPurchased,
      excessSeconds: result.excess,
      status: await getVoiceCreditStatus(userId, plan),
    };
  } catch (err) {
    // Carrera genuina contra OTRA request con el MISMO conversationId: nuestra
    // transacción completa se revirtió (ver docstring). El ganador ya
    // procesó la llamada real — devolvemos "idempotente" con su resultado,
    // nunca un error, y desde luego nunca descontamos una segunda vez.
    const isUniqueConversationIdClash =
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "P2002";
    if (isUniqueConversationIdClash) {
      return {
        idempotent: true,
        fromIncludedSeconds: 0,
        fromPurchasedSeconds: 0,
        excessSeconds: 0,
        status: await getVoiceCreditStatus(userId, plan),
      };
    }
    throw err;
  }
}

/**
 * Acredita un pack comprado — SOLO se llama desde el webhook de Stripe tras
 * confirmar el pago (ver actions/stripe.ts y api/stripe/webhook/route.ts).
 * Upsert con incremento: atómico a nivel de Postgres, seguro si dos packs
 * se acreditan casi a la vez (dos compras reales legítimas, ver spec
 * sección 16 — deben sumarse las dos, nunca pisarse).
 */
export async function creditVoicePurchasedSeconds(userId: string, seconds: number): Promise<void> {
  await prisma.voicePurchasedBalance.upsert({
    where: { userId },
    update: { remainingSeconds: { increment: seconds } },
    create: { userId, remainingSeconds: seconds },
  });
}
