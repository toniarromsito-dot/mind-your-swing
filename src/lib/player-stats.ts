import { relativeToPar, totalStrokes, holesPlayed as countHolesPlayed } from "@/lib/golf";

/**
 * Capa de agregación de estadísticas del jugador — funciones puras (sin
 * Prisma) sobre partidas ya cargadas, pensadas para ser la ÚNICA fuente de
 * estas cifras: Dashboard, Insights y el futuro Coach deben consumir
 * `computePlayerStats`, nunca recalcular por su cuenta. Ver
 * src/lib/data/player-stats.ts para la consulta que produce `PlayerRound[]`.
 *
 * Ningún umbral de muestra mínima aquí es una verdad matemática — son
 * decisiones de producto documentadas junto a cada función, para no mostrar
 * una tendencia o una media que parezca más fiable de lo que la muestra
 * permite. Por debajo del mínimo, la función devuelve `null`.
 */

export type PlayerStatsHole = {
  number: number;
  par: number;
  /** Stroke Index del hoyo (1-18); null si la partida no tiene esa plantilla. */
  index: number | null;
  strokes: number | null;
  putts: number | null;
};

export type PlayerRound = {
  gameId: string;
  course: string;
  date: Date;
  totalHoles: number;
  /** Foto del Handicap Index declarado en el momento de esta partida (GamePlayer.handicapIndex) — null si no estaba disponible entonces. */
  handicapIndex: number | null;
  holes: PlayerStatsHole[];
};

const MIN_ROUNDS_FOR_TREND = 4;
const MIN_ROUNDS_FOR_CONSISTENCY = 3;
const MIN_HOLES_FOR_PAR_BREAKDOWN = 3;
const MIN_ROUNDS_FOR_FORMAT_AVERAGE = 2;
/** Diferencia mínima (golpes relativos al par) entre la mitad reciente y la
 * anterior para considerarla una tendencia real y no ruido. */
const TREND_THRESHOLD = 1;

function average(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Relativo al par de una vuelta, o null si no se jugó ningún hoyo (evita que "0 hoyos jugados" se lea como "a la par"). */
function roundRelativeToPar(round: PlayerRound): number | null {
  if (countHolesPlayed(round.holes) === 0) return null;
  return relativeToPar(round.holes);
}

export type BestWorstRound = { gameId: string; course: string; date: Date; relativeToPar: number };

/**
 * BASE — completedRounds/holesPlayed/totalStrokes/averageStrokesPerHole/
 * averageRelativeToPar/bestRound/worstRound/recentRound/roundsThisMonth.
 *
 * Datos necesarios: partidas COMPLETED del jugador con sus hoyos y golpes.
 * Mínimo de muestra: ninguno para los conteos/sumas (siempre son ciertos,
 * incluso en 0); `averageRelativeToPar`/`bestRound`/`worstRound` requieren
 * al menos 1 vuelta con algún hoyo jugado, si no son `null`.
 * `rounds` debe venir ordenado de más reciente a más antigua (mismo orden
 * que produce la consulta) — `recentRound` es simplemente `rounds[0]`.
 */
export function computeBaseStats(rounds: PlayerRound[]) {
  const allHoles = rounds.flatMap((r) => r.holes);
  const holesPlayedCount = countHolesPlayed(allHoles);
  const totalStrokesCount = totalStrokes(allHoles);

  const withRelative = rounds
    .map((r) => ({ round: r, relative: roundRelativeToPar(r) }))
    .filter((x): x is { round: PlayerRound; relative: number } => x.relative != null);

  const averageRelativeToPar = average(withRelative.map((x) => x.relative));

  let bestRound: BestWorstRound | null = null;
  let worstRound: BestWorstRound | null = null;
  for (const { round, relative } of withRelative) {
    if (!bestRound || relative < bestRound.relativeToPar) {
      bestRound = { gameId: round.gameId, course: round.course, date: round.date, relativeToPar: relative };
    }
    if (!worstRound || relative > worstRound.relativeToPar) {
      worstRound = { gameId: round.gameId, course: round.course, date: round.date, relativeToPar: relative };
    }
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const roundsThisMonth = rounds.filter((r) => r.date >= startOfMonth).length;

  return {
    completedRounds: rounds.length,
    holesPlayed: holesPlayedCount,
    totalStrokes: totalStrokesCount,
    averageStrokesPerHole: holesPlayedCount > 0 ? totalStrokesCount / holesPlayedCount : null,
    averageRelativeToPar,
    bestRound,
    worstRound,
    recentRound: rounds[0] ?? null,
    roundsThisMonth,
  };
}

export type ConsistencyStat = { stdDev: number; sampleSize: number };

/**
 * CONSISTENCY — desviación estándar del resultado relativo al par entre
 * vueltas. Mínimo de muestra: 3 vueltas con hoyos jugados (una desviación
 * sobre 1-2 puntos no dice nada); por debajo, `null`.
 */
export function computeConsistency(rounds: PlayerRound[]): ConsistencyStat | null {
  const relatives = rounds.map(roundRelativeToPar).filter((r): r is number => r != null);
  if (relatives.length < MIN_ROUNDS_FOR_CONSISTENCY) return null;

  const mean = average(relatives)!;
  const variance = average(relatives.map((r) => (r - mean) ** 2))!;
  return { stdDev: Math.sqrt(variance), sampleSize: relatives.length };
}

export type ScoringTrend = { trend: "up" | "down"; diff: number };

/**
 * TENDENCIA — compara el resultado relativo al par medio de la mitad más
 * reciente de vueltas contra la mitad anterior (mismo patrón que
 * mood.ts/insights.ts: partir en dos y comparar, nunca una regresión
 * estadística). "up" = mejorando (relativo al par más bajo), igual que
 * `computeMonthlyScoringTrend`. Mínimo de muestra: 4 vueltas con hoyos
 * jugados, y la diferencia debe superar 1 golpe — si no, `null` (ni
 * suficientes datos ni un cambio real, no una tendencia fabricada).
 * `rounds` debe venir en el mismo orden que `computeBaseStats` (más
 * reciente primero); aquí se invierte internamente para leer en
 * cronológico.
 */
export function computeScoringTrend(rounds: PlayerRound[]): ScoringTrend | null {
  const chronological = [...rounds].reverse();
  const relatives = chronological.map(roundRelativeToPar).filter((r): r is number => r != null);
  if (relatives.length < MIN_ROUNDS_FOR_TREND) return null;

  const mid = Math.floor(relatives.length / 2);
  const older = relatives.slice(0, mid);
  const recent = relatives.slice(mid);
  const diff = average(recent)! - average(older)!;
  if (Math.abs(diff) < TREND_THRESHOLD) return null;

  return { trend: diff < 0 ? "up" : "down", diff: Math.round(diff * 10) / 10 };
}

export type ScoreBreakdown = { pars: number; birdies: number; bogeys: number; doubleBogeys: number; other: number };

/**
 * BREAKDOWN — recuento de hoyos por resultado. Bucket fijo de 5 categorías
 * (pedido explícitamente así, distinto del `computeRoundBreakdown` de
 * golf.ts que usa Coach): par=diff 0, birdie=diff -1, bogey=diff +1,
 * doubleBogey=diff +2, y "other" agrupa TODO lo demás — eagle/albatross
 * (diff <= -2) igual que triple bogey o peor (diff >= 3). Es un recuento
 * literal (no una media ni una tendencia): siempre real, incluso en 0, sin
 * mínimo de muestra.
 */
export function aggregateScoreBreakdown(rounds: PlayerRound[]): ScoreBreakdown {
  const breakdown: ScoreBreakdown = { pars: 0, birdies: 0, bogeys: 0, doubleBogeys: 0, other: 0 };
  for (const hole of rounds.flatMap((r) => r.holes)) {
    if (hole.strokes == null) continue;
    const diff = hole.strokes - hole.par;
    if (diff === 0) breakdown.pars += 1;
    else if (diff === -1) breakdown.birdies += 1;
    else if (diff === 1) breakdown.bogeys += 1;
    else if (diff === 2) breakdown.doubleBogeys += 1;
    else breakdown.other += 1;
  }
  return breakdown;
}

export type CourseBreakdown = { course: string; roundsCount: number; averageRelativeToPar: number | null };

/**
 * CAMPO — vueltas y resultado medio agrupados por `Game.course` (texto
 * congelado, no requiere GolfCourse real). `roundsCount` siempre se
 * muestra (dato literal); `averageRelativeToPar` solo cuando ese campo
 * tiene al menos 1 vuelta con hoyos jugados — con muestra pequeña (1-2
 * vueltas) el número es real pero poco estable, así que el consumidor
 * (Insights) debe mostrar `roundsCount` junto al promedio para que el
 * jugador juzgue la fiabilidad, en vez de ocultarlo.
 */
export function computeCourseBreakdown(rounds: PlayerRound[]): CourseBreakdown[] {
  const byCourse = new Map<string, PlayerRound[]>();
  for (const r of rounds) {
    const list = byCourse.get(r.course) ?? [];
    list.push(r);
    byCourse.set(r.course, list);
  }

  return [...byCourse.entries()]
    .map(([course, courseRounds]) => {
      const relatives = courseRounds.map(roundRelativeToPar).filter((r): r is number => r != null);
      return { course, roundsCount: courseRounds.length, averageRelativeToPar: average(relatives) };
    })
    .sort((a, b) => b.roundsCount - a.roundsCount);
}

export type HoleParBreakdown = { par: number; holesPlayed: number; averageRelativeToPar: number | null };

/**
 * HOYOS — rendimiento agrupado por par del hoyo (3/4/5, o cualquier otro
 * par real que exista). `holesPlayed` siempre se muestra; `averageRelativeToPar`
 * solo con al menos 3 hoyos jugados de ese par — con 1-2 hoyos el promedio
 * es ruido, no una lectura del "par 3 se te da bien/mal".
 */
export function computeHoleParBreakdown(rounds: PlayerRound[]): HoleParBreakdown[] {
  const byPar = new Map<number, PlayerStatsHole[]>();
  for (const hole of rounds.flatMap((r) => r.holes)) {
    if (hole.strokes == null) continue;
    const list = byPar.get(hole.par) ?? [];
    list.push(hole);
    byPar.set(hole.par, list);
  }

  return [...byPar.entries()]
    .map(([par, holes]) => {
      const relatives = holes.map((h) => h.strokes! - h.par);
      return {
        par,
        holesPlayed: holes.length,
        averageRelativeToPar: holes.length >= MIN_HOLES_FOR_PAR_BREAKDOWN ? average(relatives) : null,
      };
    })
    .sort((a, b) => a.par - b.par);
}

export type FormatBreakdown = { totalHoles: number; roundsCount: number; averageRelativeToPar: number | null };

/**
 * FORMATO — 9 vs 18 hoyos. `roundsCount` siempre se muestra;
 * `averageRelativeToPar` solo con al menos 2 vueltas en ese formato.
 */
export function computeFormatBreakdown(rounds: PlayerRound[]): FormatBreakdown[] {
  const byFormat = new Map<number, PlayerRound[]>();
  for (const r of rounds) {
    const list = byFormat.get(r.totalHoles) ?? [];
    list.push(r);
    byFormat.set(r.totalHoles, list);
  }

  return [...byFormat.entries()]
    .map(([totalHoles, formatRounds]) => {
      const relatives = formatRounds.map(roundRelativeToPar).filter((r): r is number => r != null);
      return {
        totalHoles,
        roundsCount: formatRounds.length,
        averageRelativeToPar: formatRounds.length >= MIN_ROUNDS_FOR_FORMAT_AVERAGE ? average(relatives) : null,
      };
    })
    .sort((a, b) => a.totalHoles - b.totalHoles);
}

export type HandicapEvolutionPoint = { date: Date; handicapIndex: number };

/**
 * HANDICAP — reconstrucción indirecta de la evolución del Handicap Index
 * DECLARADO (nunca oficial/WHS/federado) a partir de la foto congelada en
 * cada partida (`GamePlayer.handicapIndex`). Ordenado cronológicamente
 * (más antigua primero); partidas sin hándicap disponible en ese momento
 * simplemente no aportan punto — nunca se interpola ni se rellena.
 */
export function computeHandicapEvolution(rounds: PlayerRound[]): HandicapEvolutionPoint[] {
  return [...rounds]
    .reverse()
    .filter((r): r is PlayerRound & { handicapIndex: number } => r.handicapIndex != null)
    .map((r) => ({ date: r.date, handicapIndex: r.handicapIndex }));
}

export type PlayerStats = ReturnType<typeof computeBaseStats> & {
  consistency: ConsistencyStat | null;
  trend: ScoringTrend | null;
  breakdown: ScoreBreakdown;
  byCourse: CourseBreakdown[];
  byHolePar: HoleParBreakdown[];
  byFormat: FormatBreakdown[];
  handicapEvolution: HandicapEvolutionPoint[];
};

/**
 * Punto de entrada único de la capa de estadísticas — compone todas las
 * funciones de arriba sobre el mismo `PlayerRound[]`. Dashboard, Insights y
 * el futuro Coach deben llamar a esta función (vía
 * `src/lib/data/player-stats.ts#getPlayerStats`), nunca recalcular por su
 * cuenta ni volver a consultar Prisma para lo que ya está aquí.
 */
export function computePlayerStats(rounds: PlayerRound[]): PlayerStats {
  return {
    ...computeBaseStats(rounds),
    consistency: computeConsistency(rounds),
    trend: computeScoringTrend(rounds),
    breakdown: aggregateScoreBreakdown(rounds),
    byCourse: computeCourseBreakdown(rounds),
    byHolePar: computeHoleParBreakdown(rounds),
    byFormat: computeFormatBreakdown(rounds),
    handicapEvolution: computeHandicapEvolution(rounds),
  };
}
