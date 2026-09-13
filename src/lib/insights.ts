import type { Mood } from "@prisma/client";
import { computeMentalScore } from "@/lib/mood";

/**
 * Funciones puras (sin Prisma) que convierten datos reales ya
 * acumulados — check-ins de ánimo, resultados de hoyos — en los
 * insights de la pantalla /insights. Cada función devuelve `null` en
 * vez de un valor cuando no hay suficiente muestra o no hay un patrón
 * claro: no se fabrica una frase para rellenar la pantalla. Igual que en
 * mood.ts, los arrays de entradas van ordenados de más reciente a más
 * antiguo salvo que se diga lo contrario.
 */

const MIN_RECOVERY_EVENTS = 4;
const MIN_MOOD_ENTRIES_PER_GROUP = 3;
const RECOVERY_TREND_THRESHOLD = 0.2;
const CLOSING_PRESSURE_THRESHOLD = 0.15;

export type MentalTrendInsight = { trend: "up" | "down" };

/** Reutiliza computeMentalScore (mood.ts) — mismo dato, solo narrado en vez de mostrado como flecha. */
export function computeMentalTrendInsight(entries: { mood: Mood }[]): MentalTrendInsight | null {
  const score = computeMentalScore(entries);
  if (!score || score.trend === "flat") return null;
  return { trend: score.trend };
}

export type RecoveryEvent = { recovered: boolean };
export type RecoveryInsight = { trend: "up" | "down"; recentRate: number; olderRate: number };

/**
 * A partir de una lista de "momentos malos" (check-in NERVIOSO/FRUSTRADO
 * ligado a un hoyo) ya resueltos en `recovered` (si el siguiente hoyo
 * salió a la par o mejor), compara la tasa de recuperación reciente
 * contra la anterior.
 */
export function computeRecoveryInsight(events: RecoveryEvent[]): RecoveryInsight | null {
  if (events.length < MIN_RECOVERY_EVENTS) return null;

  const mid = Math.floor(events.length / 2);
  const recent = events.slice(0, mid);
  const older = events.slice(mid);
  const rate = (es: RecoveryEvent[]) => es.filter((e) => e.recovered).length / es.length;

  const recentRate = rate(recent);
  const olderRate = rate(older);
  const diff = recentRate - olderRate;
  if (Math.abs(diff) <= RECOVERY_TREND_THRESHOLD) return null;

  return { trend: diff > 0 ? "up" : "down", recentRate, olderRate };
}

export type ClosingPressureInsight = { closeFrequency: number; restFrequency: number };

/**
 * Compara la frecuencia de ánimo de presión (NERVIOSO/FRUSTRADO) entre
 * los últimos 6 hoyos de cada partida y el resto — solo si hay muestra
 * mínima en ambos grupos y la diferencia es real, no ruido.
 */
export function computeClosingPressureInsight(
  closeEntries: { mood: Mood }[],
  restEntries: { mood: Mood }[]
): ClosingPressureInsight | null {
  if (closeEntries.length < MIN_MOOD_ENTRIES_PER_GROUP || restEntries.length < MIN_MOOD_ENTRIES_PER_GROUP) return null;

  const pressureMoods: Mood[] = ["NERVIOSO", "FRUSTRADO"];
  const freq = (es: { mood: Mood }[]) => es.filter((e) => pressureMoods.includes(e.mood)).length / es.length;

  const closeFrequency = freq(closeEntries);
  const restFrequency = freq(restEntries);
  if (closeFrequency - restFrequency <= CLOSING_PRESSURE_THRESHOLD) return null;

  return { closeFrequency, restFrequency };
}

export type ScoringTrendInsight = { diff: number; trend: "up" | "down" };

/**
 * Compara el resultado medio respecto al par de este mes natural contra el
 * mes anterior — para "Tu juego este mes" del Home. Requiere al menos una
 * ronda completada en CADA mes; si falta cualquiera, no hay nada honesto
 * que comparar y se devuelve null en vez de fabricar una tendencia.
 */
export function computeMonthlyScoringTrend(
  currentMonthRelatives: number[],
  previousMonthRelatives: number[]
): ScoringTrendInsight | null {
  if (currentMonthRelatives.length === 0 || previousMonthRelatives.length === 0) return null;

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const diff = Math.round((avg(currentMonthRelatives) - avg(previousMonthRelatives)) * 10) / 10;
  if (diff === 0) return null;

  return { diff, trend: diff < 0 ? "up" : "down" };
}

