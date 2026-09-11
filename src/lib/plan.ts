import type { Plan } from "@prisma/client";
import { isOwnerEmail } from "@/lib/admin";

/**
 * Punto único para decidir si un usuario tiene acceso Pro. La cuenta OWNER
 * (ver admin.ts) tiene acceso Pro completo sin pasar por Stripe: su fila
 * en la base de datos puede seguir en plan FREE (no hay suscripción real
 * que gestionar), así que todo lo que hoy compara `user.plan === "PRO"`
 * debe usar esta función en su lugar para no dejar huecos sin cubrir.
 */
export function hasProAccess(user: { plan: Plan; email: string | null }): boolean {
  return user.plan === "PRO" || isOwnerEmail(user.email);
}
