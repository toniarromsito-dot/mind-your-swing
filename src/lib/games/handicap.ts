/**
 * Cálculo de hándicap de juego (Handicap Index → Course Handicap → Playing
 * Handicap), reparto de golpes por hoyo y resultado neto — World Handicap
 * System (WHS), adoptado por la RFEG. Fórmulas (Reglas de Hándicap del R&A/
 * USGA — Regla 6.1; RFEG, Reglas del Sistema de Hándicaps):
 *
 *   Course Handicap  = ROUND(Handicap Index × (Slope Rating / 113) + (Course Rating − Par))
 *   Playing Handicap = ROUND(Course Handicap × Handicap Allowance)
 *
 * Sin tope de 54 en el Course Handicap (solo el Handicap Index de entrada
 * está acotado a 0,0–54,0) — ver `computeCourseHandicap`.
 *
 * Reparto de golpes: el hoyo con Stroke Index 1 recibe el primer golpe
 * extra, y así sucesivamente; para un Playing Handicap superior a 18, el
 * ciclo se repite (SI 1 vuelve a recibir un golpe adicional al llegar a 19,
 * 37, 55...) — ver `strokesReceivedOnHole`, ya generalizado para esto desde
 * antes de esta fase.
 *
 * Vueltas de 9 hoyos: la Regla 6.1 exige un Course Rating/Slope/Par
 * específicos de esos 9 hoyos — nunca se aproximan a partir de los de 18
 * (el propio WHS lo desaconseja explícitamente, porque las dos mitades de
 * un campo no suelen tener la misma dificultad). Cuando el tee SÍ tiene
 * esa valoración de 9 hoyos verificada (p. ej. Santa Ponsa III, Palma
 * Pitch & Putt — FBGolf), la RFEG (Regla 6.1, "Reglas del Sistema de
 * Hándicaps" — texto verificado directamente en el PDF oficial de la
 * RFEG) distingue DOS fórmulas distintas según cuántos hoyos se jueguen
 * — nunca la misma para ambas:
 *
 *   Regla 6.1b — Vuelta de 9 hoyos:
 *     Course Handicap = ROUND((Handicap Index ÷ 2) × (Slope9/113) + (CR9 − Par9))
 *
 *   Regla 6.1a, nota 1 — Vuelta de 18 hoyos sobre el MISMO recorrido de 9
 *   (sin Course Rating de 18 propio — la misma tarjeta jugada dos veces):
 *     Course Handicap = ROUND(Handicap Index × (Slope9/113) + (2×CR9 − 2×Par9))
 *
 * IMPORTANTE (Regla 6.1b, texto literal): "Se redondea al número entero
 * más cercano como último paso del cálculo" — el Handicap Index ÷ 2 NUNCA
 * se redondea a una décima ni a ningún otro punto intermedio antes de
 * usarse en la fórmula; toda la expresión se calcula con precisión
 * completa y solo el Course Handicap final se redondea (0,5 redondea
 * hacia arriba). Redondear el HI/2 antes de tiempo puede cambiar el
 * resultado final en casos límite (ver los tests con Handicap Index
 * decimal, p. ej. 37,3).
 *
 * La fórmula de 18 sobre 9 usa el Handicap Index COMPLETO (no a la mitad)
 * porque ahora se juegan 18 hoyos de verdad; el Slope no se duplica (es un
 * ratio de dificultad, no una magnitud que crezca con el número de
 * hoyos), pero el Course Rating y el Par sí son magnitudes que se doblan
 * al jugar la misma vuelta dos veces. Ver `resolveGameHandicap` para el
 * detalle de cuándo se puede calcular y cuándo no (p. ej. Pollença, sin
 * esa valoración verificada todavía).
 *
 * Precisión (Regla 6.1 nota final + Regla 6.2a, texto literal: "Hándicap
 * de Juego = Hándicap de Campo (SIN redondear) × Porcentaje de
 * hándicap"): el Course Handicap se redondea al entero más cercano en su
 * propio punto (es un valor con entidad propia, el que se muestra al
 * jugador), pero el Playing Handicap se calcula a partir del valor SIN
 * redondear del Course Handicap × el allowance, y solo se redondea una
 * vez, al final — para no arrastrar un doble redondeo cuando el allowance
 * deje de ser 100% en una fase futura. Con allowance=1 (esta fase) el
 * resultado coincide exactamente con el Course Handicap ya redondeado.
 */

/** Course Handicap sin redondear = HI × (Slope/113) + (CR − Par). Uso interno: `resolveGameHandicap` lo necesita sin redondear para encadenar correctamente el Playing Handicap. */
function rawCourseHandicap({
  handicapIndex,
  slope,
  courseRating,
  par,
}: {
  handicapIndex: number;
  slope: number;
  courseRating: number;
  par: number;
}): number {
  return handicapIndex * (slope / 113) + (courseRating - par);
}

/** Course Handicap = HI × (Slope/113) + (CR − Par), redondeado al entero más cercano. Nunca se limita a 54 — solo el Handicap Index de entrada lo está. Válido para una vuelta de 18 hoyos reales, o una vuelta de 9 hoyos reales con su propio Course Rating/Slope/Par de 9 hoyos (usando ya el Handicap Index efectivo — ver `resolveGameHandicap`). */
export function computeCourseHandicap(args: { handicapIndex: number; slope: number; courseRating: number; par: number }): number {
  return Math.round(rawCourseHandicap(args));
}

/**
 * Course Handicap sin redondear para 18 hoyos jugados sobre el MISMO
 * recorrido de 9 hoyos reales dos veces, cuando no existe un Course
 * Rating de 18 propio del tee — Regla 6.1 RFEG/WHS. HI completo (no a la
 * mitad); Course Rating y Par de los 9 hoyos, duplicados; Slope sin
 * duplicar.
 */
function rawCourseHandicapNineHolesPlayedAsEighteen({
  handicapIndex,
  slope,
  courseRating9,
  par9,
}: {
  handicapIndex: number;
  slope: number;
  courseRating9: number;
  par9: number;
}): number {
  return handicapIndex * (slope / 113) + (2 * courseRating9 - 2 * par9);
}

/** Versión redondeada de `rawCourseHandicapNineHolesPlayedAsEighteen` — Course Handicap para 18 hoyos jugados dos veces sobre un recorrido de 9 hoyos reales. */
export function computeCourseHandicapNineHolesPlayedAsEighteen(args: {
  handicapIndex: number;
  slope: number;
  courseRating9: number;
  par9: number;
}): number {
  return Math.round(rawCourseHandicapNineHolesPlayedAsEighteen(args));
}

/** Playing Handicap = Course Handicap × allowance, redondeado. allowance=1 (100%) en esta fase: stroke play individual, sin allowances de competición todavía. Acepta tanto el Course Handicap ya redondeado como (preferible, para encadenar sin doble redondeo) su valor sin redondear. */
export function computePlayingHandicap(courseHandicap: number, allowance = 1): number {
  return Math.round(courseHandicap * allowance);
}

export type HandicapTeeContext = {
  courseRating: number | null;
  slope: number | null;
  parTotal: number | null;
  /** Número real de hoyos del tee (9 o 18) — el propio recorrido, no cuántos se juegan en la partida. */
  teeHoleCount: 9 | 18 | null;
};

export type ResolvedGameHandicap =
  | { available: true; handicapIndex: number; courseHandicap: number; playingHandicap: number; allowance: number }
  | { available: false; reason: "no-handicap-index" | "missing-course-rating" | "nine-hole-rating-unavailable" };

/**
 * Resuelve el hándicap de juego para una partida concreta, o explica por
 * qué no se puede calcular todavía — nunca inventa un Course Rating/Slope
 * que no exista. Casos sin datos suficientes:
 * - El tee no tiene Course Rating/Slope verificados en absoluto (hoy,
 *   Pollença: RFEG solo publica el cálculo artificial de 18 hoyos
 *   duplicando la tarjeta de 9, que este proyecto ya decidió no usar, y
 *   no hay todavía una valoración de 9 hoyos verificada alternativa).
 * - Se juegan 9 hoyos de un recorrido cuyo tee es de 18 reales: haría
 *   falta un Course Rating/Slope específicos de esos 9 hoyos, que no
 *   tenemos (y el WHS desaconseja aproximar a partir de los de 18).
 *
 * Cuando el tee SÍ tiene Course Rating/Slope propios de 9 hoyos y la
 * partida juega 9 o 18, se aplica la fórmula de 9 hoyos correspondiente
 * en cada caso — NUNCA la misma para ambos (Regla 6.1): a 9, Handicap
 * Index a la mitad con el Course Rating/Par de 9 hoyos tal cual; a 18
 * (la misma vuelta dos veces), Handicap Index completo con el Course
 * Rating/Par de 9 hoyos duplicados. El mismo Playing Handicap resultante
 * se aplica a ambas mitades de la vuelta de 18 porque el Stroke Index de
 * cada hoyo se repite exactamente igual (ver `resolveGameHoles`).
 */
export function resolveGameHandicap(
  handicapIndex: number | null,
  requestedHoleCount: 9 | 18,
  tee: HandicapTeeContext,
  allowance = 1
): ResolvedGameHandicap {
  if (handicapIndex == null) return { available: false, reason: "no-handicap-index" };
  if (tee.courseRating == null || tee.slope == null || tee.parTotal == null) {
    return { available: false, reason: "missing-course-rating" };
  }
  if (tee.teeHoleCount === 18 && requestedHoleCount === 9) {
    return { available: false, reason: "nine-hole-rating-unavailable" };
  }

  let raw: number;
  if (tee.teeHoleCount === 9 && requestedHoleCount === 9) {
    // Vuelta de 9 hoyos reales (Regla 6.1b): Handicap Index ÷ 2, SIN
    // redondear a una décima ni a ningún punto intermedio — el redondeo
    // al entero más cercano es el último paso del cálculo, no antes.
    raw = rawCourseHandicap({ handicapIndex: handicapIndex / 2, slope: tee.slope, courseRating: tee.courseRating, par: tee.parTotal });
  } else if (tee.teeHoleCount === 9 && requestedHoleCount === 18) {
    // 18 hoyos sobre el mismo recorrido de 9 (la misma vuelta dos veces, sin Course Rating de 18 propio).
    raw = rawCourseHandicapNineHolesPlayedAsEighteen({
      handicapIndex,
      slope: tee.slope,
      courseRating9: tee.courseRating,
      par9: tee.parTotal,
    });
  } else {
    // Recorrido de 18 hoyos reales jugado a 18.
    raw = rawCourseHandicap({ handicapIndex, slope: tee.slope, courseRating: tee.courseRating, par: tee.parTotal });
  }

  const courseHandicap = Math.round(raw);
  // Playing Handicap se calcula a partir del valor SIN redondear (ver nota
  // de precisión arriba), no del Course Handicap ya redondeado.
  const playingHandicap = computePlayingHandicap(raw, allowance);
  return { available: true, handicapIndex, courseHandicap, playingHandicap, allowance };
}

/** Forma mínima de un `Game` (o de un contexto equivalente calculado al crear/rehacer una partida) que hace falta para resolver el hándicap de cualquiera de sus jugadores: la foto del tee, ya congelada, más cuántos hoyos se juegan. */
export type GameHandicapContext = {
  totalHoles: number;
  teeCourseRating: number | null;
  teeSlope: number | null;
  teeParTotal: number | null;
  teeHoleCount: number | null;
  handicapAllowance: number | null;
};

function resolveGameHandicapFromContext(game: GameHandicapContext, handicapIndex: number | null): ResolvedGameHandicap {
  const requestedHoleCount = game.totalHoles === 9 ? 9 : 18;
  return resolveGameHandicap(
    handicapIndex,
    requestedHoleCount,
    {
      courseRating: game.teeCourseRating,
      slope: game.teeSlope,
      parTotal: game.teeParTotal,
      teeHoleCount: game.teeHoleCount === 9 ? 9 : game.teeHoleCount === 18 ? 18 : null,
    },
    game.handicapAllowance ?? 1
  );
}

/** Igual que `resolveGameHandicap`, pero a partir de los campos ya congelados en un `Game` — usado para calcular en vivo el Playing Handicap de un jugador a partir de su Handicap Index actual. Se mantiene como alternativa de lectura (p. ej. para partidas o jugadores anteriores a esta fase, que no tienen foto propia en `GamePlayer`); la fuente de verdad para partidas nuevas es `resolvePlayerHandicapSnapshot`, guardada una sola vez en `GamePlayer` en el momento de unirse. */
export function gamePlayingHandicapForIndex(game: GameHandicapContext, handicapIndex: number | null): number | null {
  const result = resolveGameHandicapFromContext(game, handicapIndex);
  return result.available ? result.playingHandicap : null;
}

export type PlayerHandicapSnapshot = {
  handicapIndex: number | null;
  courseHandicap: number | null;
  playingHandicap: number | null;
  handicapAllowance: number | null;
};

/**
 * Foto de hándicap de UN jugador concreto, para guardar en `GamePlayer` en
 * el momento en que se incorpora a la partida (al crearla, en una
 * revancha, o al unirse por código de invitación) — nunca se recalcula
 * después con el Handicap Index que el jugador tenga más adelante. Usa el
 * contexto de campo/tee ya congelado (en el `Game` si ya existe, o en los
 * mismos valores recién resueltos al crearlo) y el Handicap Index del
 * jugador EN ESE MOMENTO. Nunca fabrica un valor: si no está disponible,
 * los 4 campos quedan en null, igual que `resolveGameHandicap`.
 */
export function resolvePlayerHandicapSnapshot(game: GameHandicapContext, handicapIndex: number | null): PlayerHandicapSnapshot {
  const result = resolveGameHandicapFromContext(game, handicapIndex);
  if (!result.available) return { handicapIndex: null, courseHandicap: null, playingHandicap: null, handicapAllowance: null };
  return {
    handicapIndex: result.handicapIndex,
    courseHandicap: result.courseHandicap,
    playingHandicap: result.playingHandicap,
    handicapAllowance: result.allowance,
  };
}

/** Golpes de hándicap que recibe un jugador en un hoyo concreto, a partir de su Playing Handicap y el Stroke Index del hoyo. */
export function strokesReceivedOnHole(playingHandicap: number, holeIndex: number): number {
  const rounded = Math.round(playingHandicap);
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
 * ya jugados. `playingHandicap` debe ser el Playing Handicap ya resuelto
 * (ver `resolveGameHandicap`/`gamePlayingHandicapForIndex`), no el
 * Handicap Index declarado en bruto. Devuelve null cuando falta el dato
 * necesario (sin Playing Handicap disponible, o ningún hoyo con Stroke
 * Index) en vez de fabricar un neto.
 */
export function computeNetResult(
  holes: NetHoleResult[],
  playingHandicap: number | null
): { net: number; strokesReceived: number; parPlayed: number } | null {
  if (playingHandicap == null) return null;

  const played = holes.filter((h): h is NetHoleResult & { strokes: number; index: number } => h.strokes != null && h.index != null);
  if (played.length === 0) return null;

  let grossPlayed = 0;
  let strokesReceived = 0;
  let parPlayed = 0;
  for (const h of played) {
    grossPlayed += h.strokes;
    parPlayed += h.par;
    strokesReceived += strokesReceivedOnHole(playingHandicap, h.index);
  }

  return { net: grossPlayed - strokesReceived, strokesReceived, parPlayed };
}
