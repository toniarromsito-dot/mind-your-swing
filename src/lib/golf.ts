import type { Dictionary } from "./i18n/dictionaries";

export type HoleResult = {
  number: number;
  par: number;
  strokes: number | null;
};

/** Etiqueta del resultado de un hoyo relativa al par (Birdie, Par, Bogey...). */
export function holeResultLabel(par: number, strokes: number, labels: Dictionary["golfResult"]): string {
  const diff = strokes - par;
  const byDiff: Record<number, string> = {
    [-3]: labels.albatross,
    [-2]: labels.eagle,
    [-1]: labels.birdie,
    [0]: labels.par,
    [1]: labels.bogey,
    [2]: labels.dobleBogey,
    [3]: labels.tripleBogey,
  };
  if (diff in byDiff) return byDiff[diff];
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/** Suma de golpes jugados hasta ahora (ignora hoyos sin resultado todavía). */
export function totalStrokes(holes: HoleResult[]): number {
  return holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0);
}

/** Resultado acumulado respecto al par, solo contando hoyos ya jugados. */
export function relativeToPar(holes: HoleResult[]): number {
  return holes.reduce((sum, h) => {
    if (h.strokes == null) return sum;
    return sum + (h.strokes - h.par);
  }, 0);
}

/** Formatea el resultado relativo al par como "+3", "-2" o "E" (even/par). */
export function formatRelativeToPar(relative: number): string {
  if (relative === 0) return "E";
  return relative > 0 ? `+${relative}` : `${relative}`;
}

export function holesPlayed(holes: HoleResult[]): number {
  return holes.filter((h) => h.strokes != null).length;
}

export type RoundBreakdown = {
  birdiesOrBetter: number;
  pars: number;
  bogeys: number;
  doubleBogeysOrWorse: number;
  /** El tramo contiguo de `windowSize` hoyos con más golpes perdidos respecto al par, si lo hay. */
  worstStretch: { startHole: number; endHole: number; strokesOverPar: number } | null;
};

/**
 * Resumen numérico de una vuelta para que Mind pueda dar un análisis
 * concreto ("entre los hoyos 11 y 14 perdiste 5 golpes") sin inventar
 * cifras — los números siempre vienen de aquí, nunca del propio Claude.
 */
export function computeRoundBreakdown(holes: HoleResult[], windowSize = 4): RoundBreakdown {
  const played = holes.filter(
    (h): h is HoleResult & { strokes: number } => h.strokes != null
  );

  let birdiesOrBetter = 0;
  let pars = 0;
  let bogeys = 0;
  let doubleBogeysOrWorse = 0;
  for (const h of played) {
    const diff = h.strokes - h.par;
    if (diff <= -1) birdiesOrBetter += 1;
    else if (diff === 0) pars += 1;
    else if (diff === 1) bogeys += 1;
    else doubleBogeysOrWorse += 1;
  }

  const sorted = [...played].sort((a, b) => a.number - b.number);
  let worstStretch: RoundBreakdown["worstStretch"] = null;

  for (let i = 0; i + windowSize <= sorted.length; i++) {
    const window = sorted.slice(i, i + windowSize);
    const consecutive = window.every((h, idx) => idx === 0 || h.number === window[idx - 1].number + 1);
    if (!consecutive) continue;

    const strokesOverPar = window.reduce((sum, h) => sum + (h.strokes - h.par), 0);
    if (strokesOverPar > 0 && (!worstStretch || strokesOverPar > worstStretch.strokesOverPar)) {
      worstStretch = { startHole: window[0].number, endHole: window[window.length - 1].number, strokesOverPar };
    }
  }

  return { birdiesOrBetter, pars, bogeys, doubleBogeysOrWorse, worstStretch };
}
