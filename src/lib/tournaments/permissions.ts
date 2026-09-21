import { isAdminEmail } from "@/lib/admin";

/**
 * Quién puede gestionar un torneo (cambiar estado, cargar participantes,
 * rematching): su organizer, o un platform admin (mismo patrón ya usado en
 * /admin/videos — sin tabla de roles nueva, ver src/lib/admin.ts).
 */
export function canManageTournament(
  tournament: { organizerId: string | null },
  user: { id: string; email?: string | null }
): boolean {
  if (tournament.organizerId && tournament.organizerId === user.id) return true;
  return isAdminEmail(user.email);
}
