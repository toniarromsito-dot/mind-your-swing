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
