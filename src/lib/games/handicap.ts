/**
 * Asignación de golpes de hándicap por hoyo y resultado neto. Simplificación
 * documentada: se usa el hándicap declarado del jugador (`User.handicap`)
 * directamente como "hándicap de juego" — `GolfCourse` no tiene Slope/Course
 * Rating todavía, así que el cálculo WHS real (que sí los usa) no es posible
 * hoy. Esto es una aproximación útil, no el cálculo oficial de una federación.
 */

/** Golpes de hándicap que recibe un jugador en un hoyo concreto según su Stroke Index. */
export function strokesReceivedOnHole(courseHandicap: number, holeIndex: number): number {
  const rounded = Math.round(courseHandicap);
  if (rounded <= 0) return 0;

  const fullRounds = Math.floor(rounded / 18);
  const remainder = rounded % 18;
  return fullRounds + (holeIndex <= remainder ? 1 : 0);
}

export type NetHoleResult = {
  par: number;
  /** Stroke Index del hoyo (1-18); null si el hoyo no tiene datos de campo. */
  index: number | null;
  strokes: number | null;
};

/**
 * Golpes netos totales y golpes de hándicap recibidos, solo sobre los hoyos
 * ya jugados. Devuelve null cuando falta el dato necesario (sin hándicap
 * declarado, o ningún hoyo con Stroke Index) en vez de fabricar un neto.
 */
export function computeNetResult(
  holes: NetHoleResult[],
  courseHandicap: number | null
): { net: number; strokesReceived: number; parPlayed: number } | null {
  if (courseHandicap == null) return null;

  const played = holes.filter((h): h is NetHoleResult & { strokes: number; index: number } => h.strokes != null && h.index != null);
  if (played.length === 0) return null;

  let grossPlayed = 0;
  let strokesReceived = 0;
  let parPlayed = 0;
  for (const h of played) {
    grossPlayed += h.strokes;
    parPlayed += h.par;
    strokesReceived += strokesReceivedOnHole(courseHandicap, h.index);
  }

  return { net: grossPlayed - strokesReceived, strokesReceived, parPlayed };
}
