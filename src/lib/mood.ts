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
  entries: { mood: Mood; hole?: { number: number } | null }[]
): MoodPoint[] {
  return entries.map((e, i) => ({
    label: e.hole ? `Hoyo ${e.hole.number}` : `Check-in ${i + 1}`,
    mood: e.mood,
    score: MOOD_SCORE[e.mood],
  }));
}

export function averageMoodScore(entries: { mood: Mood }[]): number | null {
  if (entries.length === 0) return null;
  const sum = entries.reduce((acc, e) => acc + MOOD_SCORE[e.mood], 0);
  return sum / entries.length;
}
