import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isProStatus } from "@/lib/stripe";

/**
 * Fase 12C — MULTI-PROVIDER. Único sitio que recalcula User.plan: PRO si
 * CUALQUIERA de las Subscription del usuario (Stripe, RevenueCat, o
 * cualquier provider futuro) está ACTIVE/TRIALING, sea cual sea el
 * provider — FREE si ninguna lo está. Se llama SIEMPRE después de escribir
 * la fila Subscription de UN provider concreto, nunca antes — así lee el
 * estado ya actualizado de esa fila junto con el de las demás.
 *
 * No toca el bypass de owner (isOwnerEmail) — ese vive exclusivamente en
 * hasProAccess() como una comprobación de lectura, nunca escrito en
 * User.plan; un owner puede seguir teniendo plan=FREE en la fila real
 * mientras hasProAccess() le concede acceso igualmente. Esta función jamás
 * decide eso, solo refleja el estado real de las suscripciones.
 *
 * Recibe el cliente de Prisma (normal o de una transacción, `tx`) para que
 * el caller controle la atomicidad: el webhook de Stripe y el futuro
 * webhook de RevenueCat deben llamarla DENTRO de la misma transacción que
 * escribe su propia fila Subscription, nunca como una escritura suelta
 * aparte — así un fallo a mitad de proceso nunca deja User.plan
 * desincronizado de las filas Subscription reales.
 */
export async function recomputeUserPlan(
  tx: Prisma.TransactionClient | typeof prisma,
  userId: string
): Promise<void> {
  const rows = await tx.subscription.findMany({
    where: { userId },
    select: { status: true },
  });
  const isPro = rows.some((row) => isProStatus(row.status));
  await tx.user.update({ where: { id: userId }, data: { plan: isPro ? "PRO" : "FREE" } });
}
