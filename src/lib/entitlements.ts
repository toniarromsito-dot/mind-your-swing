import type { Plan } from "@prisma/client";
import { hasProAccess } from "@/lib/plan";

/**
 * Fase 11C — capa de capacidades por encima de hasProAccess(). Un único
 * sitio para enumerar, por nombre, cada funcionalidad Pro del producto —
 * en vez de repartir `if (user.plan === "PRO")` por cada Server Action,
 * ruta o Server Component. Hoy cada capacidad se resuelve exactamente
 * igual (hasProAccess), pero tenerlas nombradas es lo que hace posible
 * auditar la matriz completa desde un solo sitio y, más adelante, que una
 * capacidad concreta (p.ej. SWING_AI) pase de "todo o nada" a "hasta N
 * veces al mes" sin que ningún caller tenga que cambiar — solo esta
 * función.
 *
 * No se listan las funciones FREE (jugar, publicar posts, Coach básico,
 * Insights básicos, definiciones de Aprende, Voice limitado, Stroke
 * Play/Stableford/Scramble): no necesitan gate, así que no tiene sentido
 * darles una entrada aquí.
 */
export type Feature =
  | "COACH_MEMORY"
  | "ADVANCED_INSIGHTS"
  | "PROACTIVE_INSIGHTS"
  | "SWING_AI"
  | "LEARN_VIDEOS"
  | "COMMUNITY_REPLIES"
  | "VOICE_PRO"
  | "ADVANCED_GAME_CREATION"
  | "AD_FREE";

/**
 * Todas las capacidades de esta fase son Pro-o-nada — de ahí que el mapa
 * de abajo sea trivial hoy. Se deja como mapa (no como `hasProAccess(user)`
 * directo) precisamente para que el día que una capacidad necesite algo más
 * que un booleano (créditos de Swing AI, minutos de Voice) cambie solo
 * aquí dentro, nunca en los callers.
 */
const PRO_FEATURES: ReadonlySet<Feature> = new Set<Feature>([
  "COACH_MEMORY",
  "ADVANCED_INSIGHTS",
  "PROACTIVE_INSIGHTS",
  "SWING_AI",
  "LEARN_VIDEOS",
  "COMMUNITY_REPLIES",
  "VOICE_PRO",
  "ADVANCED_GAME_CREATION",
  "AD_FREE",
]);

/**
 * Punto único para "¿puede este usuario usar X?". Sigue dependiendo de
 * hasProAccess() (que a su vez ya cubre el bypass de owner) — esto NUNCA
 * debe convertirse en una comprobación paralela tipo `isAdFree`/`isPremium`.
 *
 * VOICE_PRO es la excepción a "todo o nada": Voice ya tiene su propio
 * sistema de cuota mensual (ver canStartVoiceCall en src/lib/billing.ts),
 * así que esta función solo confirma que la capacidad EXISTE para el plan
 * — el control real de cuánto puede usarla sigue viviendo en billing.ts,
 * no aquí.
 */
export function canUseFeature(user: { plan: Plan; email: string | null }, feature: Feature): boolean {
  if (!PRO_FEATURES.has(feature)) return true;
  return hasProAccess(user);
}
