/**
 * Rate limiting básico en memoria para el endpoint de chat con la IA.
 * Suficiente para una única instancia; en un despliegue serverless con
 * múltiples instancias concurrentes, sustituir por un store compartido
 * (ej. Upstash Redis) si el volumen lo justifica.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

const hits = new Map<string, number[]>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const existing = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (existing.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = existing[0] + WINDOW_MS - now;
    hits.set(key, existing);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  existing.push(now);
  hits.set(key, existing);
  return { allowed: true, retryAfterMs: 0 };
}
