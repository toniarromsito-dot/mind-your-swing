/**
 * Acceso de administrador (revisión manual de vídeos de swing) y de
 * propietario (acceso Pro completo sin Stripe, para desarrollar y enseñar
 * el producto) por listas de emails en variables de entorno — no hay un
 * rol en base de datos porque de momento solo lo usa Antonio/Toni. Un
 * owner es también admin (ver isAdminEmail) sin necesidad de duplicar su
 * email en ambas listas.
 */
function emailSet(envVar: string | undefined): Set<string> {
  return new Set(
    (envVar ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function adminEmails(): Set<string> {
  return emailSet(process.env.ADMIN_EMAILS);
}

function ownerEmails(): Set<string> {
  return emailSet(process.env.OWNER_EMAILS);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().has(email.toLowerCase());
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.toLowerCase()) || isOwnerEmail(email);
}
