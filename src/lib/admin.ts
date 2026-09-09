/**
 * Acceso de administrador (revisión manual de vídeos de swing) por lista
 * de emails en variable de entorno — no hay un rol en base de datos
 * porque de momento solo lo usa Antonio.
 */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.toLowerCase());
}
