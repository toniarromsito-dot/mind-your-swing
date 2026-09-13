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

function trendFromScores(recentAvg: number, olderAvg: number, threshold: number): MentalTrend {
  const diff = recentAvg - olderAvg;
  return diff > threshold ? "up" : diff < -threshold ? "down" : "flat";
}

/** Frecuencia (0-1) de un ánimo concreto dentro de un conjunto de entradas. */
function frequency(entries: { mood: Mood }[], moods: Mood[]): number {
  if (entries.length === 0) return 0;
  return entries.filter((e) => moods.includes(e.mood)).length / entries.length;
}

export type MentalScore = {
  score: number;
  trend: MentalTrend;
  /** Confianza/foco/presión: derivados de la frecuencia real de cada
   * ánimo concreto (CONFIADO/CONCENTRADO/NERVIOSO+FRUSTRADO) reciente vs.
   * anterior — una lectura honesta de los mismos check-ins, no una
   * métrica inventada aparte. Con pocos datos, "flat" por defecto. */
  confidence: MentalTrend;
  focus: MentalTrend;
  pressure: MentalTrend;
};

/**
 * "Tu juego mental" del dashboard: una puntuación 0-100 (reescala
 * MOOD_SCORE de -2..2) + tendencia general, más confianza/foco/presión
 * como tres lentes distintas sobre el mismo humor reciente. `entries`
 * debe venir ordenado de más reciente a más antiguo.
 */
export function computeMentalScore(entries: { mood: Mood }[]): MentalScore | null {
  const avg = averageMoodScore(entries);
  if (avg == null) return null;
  const score = Math.round(((avg + 2) / 4) * 100);

  if (entries.length < 4) {
    return { score, trend: "flat", confidence: "flat", focus: "flat", pressure: "flat" };
  }

  const mid = Math.floor(entries.length / 2);
  const recent = entries.slice(0, mid);
  const older = entries.slice(mid);

  const trend = trendFromScores(averageMoodScore(recent)!, averageMoodScore(older)!, 0.3);
  const confidence = trendFromScores(frequency(recent, ["CONFIADO"]), frequency(older, ["CONFIADO"]), 0.15);
  const focus = trendFromScores(frequency(recent, ["CONCENTRADO"]), frequency(older, ["CONCENTRADO"]), 0.15);
  const pressure = trendFromScores(
    frequency(recent, ["NERVIOSO", "FRUSTRADO"]),
    frequency(older, ["NERVIOSO", "FRUSTRADO"]),
    0.15
  );

  return { score, trend, confidence, focus, pressure };
}
