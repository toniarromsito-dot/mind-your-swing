import type { Mood } from "@prisma/client";

export const MOOD_LABELS: Record<Mood, string> = {
  TRANQUILO: "Tranquilo",
  NERVIOSO: "Nervioso",
  FRUSTRADO: "Frustrado",
  CONFIADO: "Confiado",
  CONCENTRADO: "Concentrado",
};

export const MOOD_EMOJI: Record<Mood, string> = {
  TRANQUILO: "🙂",
  NERVIOSO: "😬",
  FRUSTRADO: "😤",
  CONFIADO: "😎",
  CONCENTRADO: "🎯",
};

/**
 * Puntuación numérica de -2 a 2 usada solo para graficar la evolución
 * anímica; no representa ningún juicio clínico, es una heurística simple
 * para visualizar tendencia (frustrado/nervioso = negativo, confiado/
 * concentrado = positivo, tranquilo = neutro-positivo).
 */
export const MOOD_SCORE: Record<Mood, number> = {
  FRUSTRADO: -2,
  NERVIOSO: -1,
  TRANQUILO: 1,
  CONCENTRADO: 2,
  CONFIADO: 2,
};

export type MoodPoint = { label: string; mood: Mood; score: number };

export function moodTrend(
  entries: { mood: Mood; hole?: { number: number } | null }[],
  labels: { hole: (n: number) => string; checkin: (n: number) => string }
): MoodPoint[] {
  return entries.map((e, i) => ({
    label: e.hole ? labels.hole(e.hole.number) : labels.checkin(i + 1),
    mood: e.mood,
    score: MOOD_SCORE[e.mood],
  }));
}

export function averageMoodScore(entries: { mood: Mood }[]): number | null {
  if (entries.length === 0) return null;
  const sum = entries.reduce((acc, e) => acc + MOOD_SCORE[e.mood], 0);
  return sum / entries.length;
}

export type MentalTrend = "up" | "down" | "flat";

/**
 * "Tu juego mental" del dashboard: una puntuación 0-100 (reescala
 * MOOD_SCORE de -2..2) + UNA tendencia general, no confianza/foco/presión
 * por separado — con solo 5 categorías de ánimo, partir eso en 3 métricas
 * distintas sería inventar precisión que los datos no tienen. `entries`
 * debe venir ordenado de más reciente a más antiguo.
 */
export function computeMentalScore(entries: { mood: Mood }[]): { score: number; trend: MentalTrend } | null {
  const avg = averageMoodScore(entries);
  if (avg == null) return null;
  const score = Math.round(((avg + 2) / 4) * 100);

  if (entries.length < 4) return { score, trend: "flat" };

  const mid = Math.floor(entries.length / 2);
  const recentAvg = averageMoodScore(entries.slice(0, mid))!;
  const olderAvg = averageMoodScore(entries.slice(mid))!;
  const diff = recentAvg - olderAvg;
  const trend: MentalTrend = diff > 0.3 ? "up" : diff < -0.3 ? "down" : "flat";

  return { score, trend };
}
