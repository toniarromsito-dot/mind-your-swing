export type HoleResult = {
  number: number;
  par: number;
  strokes: number | null;
};

const RESULT_LABELS: Record<number, string> = {
  [-3]: "Albatross",
  [-2]: "Eagle",
  [-1]: "Birdie",
  [0]: "Par",
  [1]: "Bogey",
  [2]: "Doble bogey",
  [3]: "Triple bogey",
};

/** Etiqueta del resultado de un hoyo relativa al par (Birdie, Par, Bogey...). */
export function holeResultLabel(par: number, strokes: number): string {
  const diff = strokes - par;
  if (diff in RESULT_LABELS) return RESULT_LABELS[diff];
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
