/**
 * Rate limiting básico en memoria — Fase 11A lo extiende de "solo el chat"
 * a cualquier operación server-side con coste variable (crear partida,
 * finalizarla, analizar un swing...). Sigue siendo en memoria de proceso
 * (un límite real solo dentro de la misma instancia serverless) a
 * propósito: la firma de `checkRateLimit` ya acepta `key` +
 * `windowMs`/`maxRequests` por llamada, así que el día que haga falta un
 * store compartido (Redis/Upstash), solo cambia lo que hay DENTRO de esta
 * función — ningún caller tiene que tocarse.
 */
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS_PER_WINDOW = 12;

const hits = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  options?: { windowMs?: number; maxRequests?: number }
): { allowed: boolean; retryAfterMs: number } {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS_PER_WINDOW;

  const now = Date.now();
  const windowStart = now - windowMs;
  const existing = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (existing.length >= maxRequests) {
    const retryAfterMs = existing[0] + windowMs - now;
    hits.set(key, existing);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  existing.push(now);
  hits.set(key, existing);
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Solo para tests de integración: el estado vive en memoria del módulo, así
 * que dentro de un mismo archivo de test se acumula entre `it()` — sin
 * esto, un fixture que reutiliza un usuario para crear varias partidas
 * puede chocar con el límite real sin que eso sea lo que ese test prueba.
 * Se llama desde vitest.integration.setup.ts antes de cada test, nunca
 * desde código de producción.
 */
export function resetRateLimitsForTests(): void {
  hits.clear();
}
