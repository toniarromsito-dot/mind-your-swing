/**
 * "Iniciar sesión con Apple" solo se activa cuando existen sus credenciales
 * (AUTH_APPLE_ID = Services ID, AUTH_APPLE_SECRET = client secret JWT
 * firmado con la clave .p8 — ver README / .env.example). Sin ellas, ni el
 * provider se registra ni se pinta el botón: nada queda a medias.
 *
 * Módulo aparte de src/lib/auth.ts para poder consultarlo desde cualquier
 * Server Component sin arrastrar NextAuth.
 */
export function isAppleSignInConfigured(): boolean {
  return Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET);
}
