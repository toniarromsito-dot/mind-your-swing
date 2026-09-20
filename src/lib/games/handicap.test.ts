import { describe, expect, it } from "vitest";
import {
  computeCourseHandicap,
  computeNetResult,
  computePlayingHandicap,
  gamePlayingHandicapForIndex,
  resolveGameHandicap,
  resolvePlayerHandicapSnapshot,
  strokesReceivedOnHole,
} from "./handicap";

// Golf Alcanada, tee AMARILLAS (M) — datos reales verificados de RFEG ya
// cargados en producción: CR 72.4, Slope 135, Par 72, 6193 m. Hoyo a hoyo
// real (number, par, index/SI, distance) usado en el importador de tees
// adicionales de la fase de Mallorca.
const ALCANADA_AMARILLAS_M = { courseRating: 72.4, slope: 135, parTotal: 72 };
const ALCANADA_AMARILLAS_M_HOLES = [
  { number: 1, par: 5, index: 11, distance: 450 },
  { number: 2, par: 4, index: 4, distance: 368 },
  { number: 3, par: 4, index: 12, distance: 314 },
  { number: 4, par: 3, index: 16, distance: 160 },
  { number: 5, par: 4, index: 7, distance: 353 },
  { number: 6, par: 3, index: 17, distance: 137 },
  { number: 7, par: 5, index: 3, distance: 561 },
  { number: 8, par: 4, index: 1, distance: 398 },
  { number: 9, par: 4, index: 5, distance: 374 },
  { number: 10, par: 4, index: 10, distance: 348 },
  { number: 11, par: 5, index: 6, distance: 535 },
  { number: 12, par: 4, index: 8, distance: 324 },
  { number: 13, par: 5, index: 18, distance: 492 },
  { number: 14, par: 3, index: 14, distance: 145 },
  { number: 15, par: 4, index: 13, distance: 297 },
  { number: 16, par: 4, index: 2, distance: 418 },
  { number: 17, par: 3, index: 9, distance: 194 },
  { number: 18, par: 4, index: 15, distance: 325 },
];

// Golf Pollença, recorrido real de 9 hoyos — Course Rating/Slope NULL a
// propósito (RFEG solo publica el cálculo artificial de 18 hoyos
// duplicando la tarjeta de 9; este proyecto decidió no usarlo y no hay
// todavía una valoración de 9 hoyos verificada alternativa).
const POLLENCA_9 = { courseRating: null, slope: null, parTotal: 35 };
// Santa Ponsa III y Palma Pitch & Putt SÍ tienen Course Rating/Slope de 9
// hoyos verificados (FBGolf) — datos reales ya cargados en producción.
const SANTA_PONSA_III_9 = { courseRating: 29.6, slope: 101, parTotal: 30 };
const PALMA_PITCH_AND_PUTT_9 = { courseRating: 24.4, slope: 55, parTotal: 27 };

describe("strokesReceivedOnHole", () => {
  it("gives one stroke on a hole whose index is within the handicap (the user's own example)", () => {
    // Hándicap 14 · Hoyo par 4 · SI 3 → recibe 1 golpe.
    expect(strokesReceivedOnHole(14, 3)).toBe(1);
  });

  it("gives no extra stroke on a hole whose index is above the handicap", () => {
    expect(strokesReceivedOnHole(14, 15)).toBe(0);
  });

  it("gives a second stroke on the hardest holes once handicap exceeds 18", () => {
    expect(strokesReceivedOnHole(20, 2)).toBe(2); // 1 full round + index 2 <= remainder 2
    expect(strokesReceivedOnHole(20, 5)).toBe(1); // 1 full round, index 5 > remainder 2
  });

  it("treats zero or negative handicap as receiving no strokes", () => {
    expect(strokesReceivedOnHole(0, 1)).toBe(0);
    expect(strokesReceivedOnHole(-2, 1)).toBe(0);
  });

  it("rounds a fractional handicap before allocating", () => {
    expect(strokesReceivedOnHole(14.6, 3)).toBe(1); // rounds to 15, still 1 full round below 18
  });
});

describe("computeNetResult", () => {
  it("subtracts strokes received across played holes from the gross total", () => {
    const holes = [
      { par: 4, index: 3, strokes: 5 }, // hcp 14 -> receives 1 -> net 4
      { par: 4, index: 15, strokes: 5 }, // receives 0 -> net 5
    ];
    const result = computeNetResult(holes, 14);
    expect(result).toEqual({ net: 9, strokesReceived: 1, parPlayed: 8 });
  });

  it("ignores holes without a recorded score", () => {
    const holes = [
      { par: 4, index: 3, strokes: 5 },
      { par: 4, index: 10, strokes: null },
    ];
    const result = computeNetResult(holes, 14);
    expect(result?.parPlayed).toBe(4);
  });

  it("returns null when the player has no declared handicap", () => {
    const holes = [{ par: 4, index: 3, strokes: 5 }];
    expect(computeNetResult(holes, null)).toBeNull();
  });

  it("returns null when no played hole has stroke-index data (custom course)", () => {
    const holes = [{ par: 4, index: null, strokes: 5 }];
    expect(computeNetResult(holes, 14)).toBeNull();
  });

  it("el ejemplo del brief: par 4, 5 golpes, 1 golpe de hándicap -> 4 netos", () => {
    // Playing Handicap 10, SI 5 del hoyo -> floor(10/18)=0, remainder=10, 5<=10 -> 1 golpe.
    const result = computeNetResult([{ par: 4, index: 5, strokes: 5 }], 10);
    expect(result).toEqual({ net: 4, strokesReceived: 1, parPlayed: 4 });
  });
});

describe("computeCourseHandicap — Golf Alcanada, tee AMARILLAS (M): CR 72.4, Slope 135, Par 72", () => {
  it("Handicap Index 0", () => {
    expect(computeCourseHandicap({ handicapIndex: 0, slope: ALCANADA_AMARILLAS_M.slope, courseRating: ALCANADA_AMARILLAS_M.courseRating, par: ALCANADA_AMARILLAS_M.parTotal })).toBe(0);
  });

  it("Handicap Index 14", () => {
    expect(computeCourseHandicap({ handicapIndex: 14, slope: ALCANADA_AMARILLAS_M.slope, courseRating: ALCANADA_AMARILLAS_M.courseRating, par: ALCANADA_AMARILLAS_M.parTotal })).toBe(17);
  });

  it("Handicap Index 37", () => {
    expect(computeCourseHandicap({ handicapIndex: 37, slope: ALCANADA_AMARILLAS_M.slope, courseRating: ALCANADA_AMARILLAS_M.courseRating, par: ALCANADA_AMARILLAS_M.parTotal })).toBe(45);
  });

  it("Handicap Index 54 (el máximo declarable) da un Course Handicap superior a 54, sin límite artificial", () => {
    const courseHandicap = computeCourseHandicap({ handicapIndex: 54, slope: ALCANADA_AMARILLAS_M.slope, courseRating: ALCANADA_AMARILLAS_M.courseRating, par: ALCANADA_AMARILLAS_M.parTotal });
    expect(courseHandicap).toBe(65);
    expect(courseHandicap).toBeGreaterThan(54);
  });
});

describe("computePlayingHandicap", () => {
  it("con allowance 100% (stroke play individual, esta fase) el Playing Handicap coincide con el Course Handicap", () => {
    expect(computePlayingHandicap(17, 1)).toBe(17);
  });

  it("aplica un allowance distinto de 100% si se pasa explícitamente (no usado todavía por el producto, pero el mecanismo funciona)", () => {
    expect(computePlayingHandicap(45, 0.95)).toBe(43); // round(45 * 0.95) = round(42.75) = 43
  });
});

describe("resolveGameHandicap — casos sin disponibilidad", () => {
  it("campo de 9 hoyos sobre un tee de 18 reales: no disponible (haría falta un Course Rating/Slope de 9 hoyos que no tenemos)", () => {
    const result = resolveGameHandicap(14, 9, { ...ALCANADA_AMARILLAS_M, teeHoleCount: 18 }, 1);
    expect(result).toEqual({ available: false, reason: "nine-hole-rating-unavailable" });
  });

  it("sin Handicap Index declarado: no disponible", () => {
    const result = resolveGameHandicap(null, 18, { ...ALCANADA_AMARILLAS_M, teeHoleCount: 18 }, 1);
    expect(result).toEqual({ available: false, reason: "no-handicap-index" });
  });

  it("Pollença a 18 hoyos: no disponible — el tee no tiene Course Rating/Slope verificados todavía", () => {
    const result = resolveGameHandicap(14, 18, { ...POLLENCA_9, teeHoleCount: 9 }, 1);
    expect(result).toEqual({ available: false, reason: "missing-course-rating" });
  });

  it("Pollença a 9 hoyos: tampoco disponible, por el mismo motivo (sigue sin Course Rating/Slope)", () => {
    const result = resolveGameHandicap(14, 9, { ...POLLENCA_9, teeHoleCount: 9 }, 1);
    expect(result).toEqual({ available: false, reason: "missing-course-rating" });
  });
});

// Las dos fórmulas de la Regla 6.1 dan resultados DISTINTOS a propósito —
// nunca el mismo cálculo para 9 que para 18 sobre el mismo recorrido.
// Comprobado con HI 14/27/37/54 en los dos recorridos reales de 9 hoyos
// que sí tienen Course Rating/Slope verificados (Santa Ponsa III, Palma
// Pitch & Putt) — Pollença queda fuera porque no tiene esa valoración.
describe("resolveGameHandicap — 1. campo de 18 hoyos reales (Alcanada, AMARILLAS M) jugado a 18", () => {
  it.each([
    [0, 0],
    [14, 17],
    [27, 33],
    [37, 45],
    [54, 65],
  ])("HI %d -> Course/Playing Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 18, { ...ALCANADA_AMARILLAS_M, teeHoleCount: 18 }, 1);
    expect(result).toEqual({ available: true, handicapIndex, courseHandicap: expected, playingHandicap: expected, allowance: 1 });
  });
});

describe("resolveGameHandicap — 2. recorrido de 9 hoyos reales, vuelta de 9 (Regla 6.1: HI a la mitad, CR9/Par9 tal cual)", () => {
  it.each([
    [14, 6],
    [27, 12],
    [37, 16],
    [54, 24],
  ])("Santa Ponsa III, HI %d -> Course Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 9, { ...SANTA_PONSA_III_9, teeHoleCount: 9 }, 1);
    expect(result).toEqual({ available: true, handicapIndex, courseHandicap: expected, playingHandicap: expected, allowance: 1 });
  });

  it.each([
    [14, 1],
    [27, 4],
    [37, 6],
    [54, 11],
  ])("Palma Pitch & Putt, HI %d -> Course Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 9, { ...PALMA_PITCH_AND_PUTT_9, teeHoleCount: 9 }, 1);
    expect(result).toEqual({ available: true, handicapIndex, courseHandicap: expected, playingHandicap: expected, allowance: 1 });
  });
});

describe("resolveGameHandicap — 3. recorrido de 9 hoyos reales, vuelta de 18 (la misma vuelta dos veces: HI completo, CR9/Par9 duplicados)", () => {
  it.each([
    [14, 12],
    [27, 23],
    [37, 32],
    [54, 47],
  ])("Santa Ponsa III a 18, HI %d -> Course Handicap %d (NO el mismo valor que a 9 hoyos)", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 18, { ...SANTA_PONSA_III_9, teeHoleCount: 9 }, 1);
    expect(result).toEqual({ available: true, handicapIndex, courseHandicap: expected, playingHandicap: expected, allowance: 1 });

    // Comprobación cruzada explícita: la fórmula de 9 y la de 18 son
    // DISTINTAS — el resultado de 18 no es simplemente el doble del de 9
    // (el redondeo a una décima del HI/2 y el redondeo final de cada
    // Course Handicap se hacen por separado en cada fórmula).
    const nineHoleResult = resolveGameHandicap(handicapIndex, 9, { ...SANTA_PONSA_III_9, teeHoleCount: 9 }, 1);
    if (!result.available || !nineHoleResult.available) throw new Error("expected both to be available");
    expect(result.courseHandicap).not.toBe(nineHoleResult.courseHandicap);
  });

  it.each([
    [14, 2],
    [27, 8],
    [37, 13],
    [54, 21],
  ])("Palma Pitch & Putt a 18, HI %d -> Course Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 18, { ...PALMA_PITCH_AND_PUTT_9, teeHoleCount: 9 }, 1);
    expect(result).toEqual({ available: true, handicapIndex, courseHandicap: expected, playingHandicap: expected, allowance: 1 });
  });

  it("ejemplo exacto de comprobación del informe (Santa Ponsa III, HI 27): 9 hoyos da 12, 18 hoyos da 23 — no 24", () => {
    const nine = resolveGameHandicap(27, 9, { ...SANTA_PONSA_III_9, teeHoleCount: 9 }, 1);
    const eighteen = resolveGameHandicap(27, 18, { ...SANTA_PONSA_III_9, teeHoleCount: 9 }, 1);
    expect(nine).toMatchObject({ available: true, courseHandicap: 12 });
    expect(eighteen).toMatchObject({ available: true, courseHandicap: 23 });
  });
});

// Regla 6.1b, texto literal de la RFEG: "Se redondea al número entero más
// cercano como último paso del cálculo" — el Handicap Index ÷ 2 de la
// fórmula de 9 hoyos NUNCA se redondea a una décima antes de usarse; solo
// el Course Handicap final se redondea. Estos tests usan Handicap Index
// decimales para detectar cualquier redondeo intermedio indebido, en las
// dos fórmulas de 9 hoyos reales (vuelta de 9 y vuelta de 18 sobre el
// mismo recorrido) y en los dos tees de 9 hoyos con Course Rating/Slope
// verificados (Santa Ponsa III, Palma Pitch & Putt). Valores esperados
// calculados ejecutando la fórmula exacta (sin redondeo intermedio), no a
// mano.
describe("resolveGameHandicap — Handicap Index decimal, vuelta de 9 (Regla 6.1b: sin redondeo intermedio de HI/2)", () => {
  it.each([
    [14.1, 6],
    [14.3, 6],
    [14.7, 6],
    [37.3, 16],
    [37.7, 16],
  ])("Santa Ponsa III, HI %s -> Course Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 9, { ...SANTA_PONSA_III_9, teeHoleCount: 9 }, 1);
    expect(result).toMatchObject({ available: true, courseHandicap: expected, playingHandicap: expected });
  });

  it.each([
    [14.1, 1],
    [14.3, 1],
    [14.7, 1],
    [37.3, 6],
    [37.7, 7],
  ])("Palma Pitch & Putt, HI %s -> Course Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 9, { ...PALMA_PITCH_AND_PUTT_9, teeHoleCount: 9 }, 1);
    expect(result).toMatchObject({ available: true, courseHandicap: expected, playingHandicap: expected });
  });

  it("caso de regresión: HI 37,3 en Palma Pitch & Putt da Course Handicap 6, NO 7 — redondear HI/2 a una décima antes de calcular (bug corregido) daría 7 en este caso límite", () => {
    const result = resolveGameHandicap(37.3, 9, { ...PALMA_PITCH_AND_PUTT_9, teeHoleCount: 9 }, 1);
    expect(result).toMatchObject({ available: true, courseHandicap: 6 });
  });
});

describe("resolveGameHandicap — Handicap Index decimal, vuelta de 18 sobre un recorrido de 9 (HI completo, sin redondeo intermedio)", () => {
  it.each([
    [14.1, 12],
    [14.3, 12],
    [14.7, 12],
    [37.3, 33],
    [37.7, 33],
  ])("Santa Ponsa III a 18, HI %s -> Course Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 18, { ...SANTA_PONSA_III_9, teeHoleCount: 9 }, 1);
    expect(result).toMatchObject({ available: true, courseHandicap: expected, playingHandicap: expected });
  });

  it.each([
    [14.1, 2],
    [14.3, 2],
    [14.7, 2],
    [37.3, 13],
    [37.7, 13],
  ])("Palma Pitch & Putt a 18, HI %s -> Course Handicap %d", (handicapIndex, expected) => {
    const result = resolveGameHandicap(handicapIndex, 18, { ...PALMA_PITCH_AND_PUTT_9, teeHoleCount: 9 }, 1);
    expect(result).toMatchObject({ available: true, courseHandicap: expected, playingHandicap: expected });
  });
});

describe("resolvePlayerHandicapSnapshot", () => {
  const gameContext = {
    totalHoles: 9,
    teeCourseRating: PALMA_PITCH_AND_PUTT_9.courseRating,
    teeSlope: PALMA_PITCH_AND_PUTT_9.slope,
    teeParTotal: PALMA_PITCH_AND_PUTT_9.parTotal,
    teeHoleCount: 9,
    handicapAllowance: 1,
  };

  it("congela Handicap Index/Course Handicap/Playing Handicap/allowance de un jugador con hándicap decimal", () => {
    expect(resolvePlayerHandicapSnapshot(gameContext, 37.3)).toEqual({
      handicapIndex: 37.3,
      courseHandicap: 6,
      playingHandicap: 6,
      handicapAllowance: 1,
    });
  });

  it("nunca fabrica un valor: sin Handicap Index declarado, los 4 campos quedan en null", () => {
    expect(resolvePlayerHandicapSnapshot(gameContext, null)).toEqual({
      handicapIndex: null,
      courseHandicap: null,
      playingHandicap: null,
      handicapAllowance: null,
    });
  });
});

describe("reparto de golpes en la segunda vuelta (recorrido de 9 reales jugado a 18)", () => {
  it("Palma Pitch & Putt a 18, HI 54 (Playing Handicap 21): el hoyo repetido en la segunda vuelta recibe los mismos golpes que en la primera", () => {
    // Stroke Index reales de Palma Pitch & Putt (hoyos 1-9); GameHole 10-18
    // clona exactamente los mismos valores (ver resolveGameHoles).
    const siByHole = [17, 13, 11, 5, 9, 15, 1, 7, 3];
    const result = resolveGameHandicap(54, 18, { ...PALMA_PITCH_AND_PUTT_9, teeHoleCount: 9 }, 1);
    if (!result.available) throw new Error("expected available");
    expect(result.playingHandicap).toBe(21);
    const playingHandicap = result.playingHandicap;

    const firstLoopStrokes = siByHole.map((si) => strokesReceivedOnHole(playingHandicap, si));
    const secondLoopStrokes = siByHole.map((si) => strokesReceivedOnHole(playingHandicap, si));
    expect(secondLoopStrokes).toEqual(firstLoopStrokes);

    // Playing Handicap 21 -> floor(21/18)=1, remainder=3: SI 1 y SI 3 reciben un segundo golpe, el resto 1.
    expect(firstLoopStrokes[6]).toBe(2); // hoyo 7, SI 1
    expect(firstLoopStrokes[8]).toBe(2); // hoyo 9, SI 3
    expect(firstLoopStrokes.filter((s) => s === 1)).toHaveLength(7);
  });
});

describe("gamePlayingHandicapForIndex", () => {
  it("resuelve el Playing Handicap de un jugador a partir de los campos ya congelados en un Game (Alcanada, 18 hoyos)", () => {
    const game = {
      totalHoles: 18,
      teeCourseRating: ALCANADA_AMARILLAS_M.courseRating,
      teeSlope: ALCANADA_AMARILLAS_M.slope,
      teeParTotal: ALCANADA_AMARILLAS_M.parTotal,
      teeHoleCount: 18,
      handicapAllowance: 1,
    };
    expect(gamePlayingHandicapForIndex(game, 14)).toBe(17);
  });

  it("devuelve null (sin fabricar un número) cuando el Game no tiene tee real congelado — partidas de texto libre o anteriores a esta fase", () => {
    const game = {
      totalHoles: 18,
      teeCourseRating: null,
      teeSlope: null,
      teeParTotal: null,
      teeHoleCount: null,
      handicapAllowance: null,
    };
    expect(gamePlayingHandicapForIndex(game, 14)).toBeNull();
  });
});

describe("strokesReceivedOnHole — reparto real sobre las 18 SI de Golf Alcanada (AMARILLAS M)", () => {
  const siValues = ALCANADA_AMARILLAS_M_HOLES.map((h) => h.index);

  it("Playing Handicap < 18 (17): todos los hoyos reciben 1 golpe salvo el de SI 18", () => {
    const strokes = siValues.map((si) => strokesReceivedOnHole(17, si));
    expect(strokes.filter((s) => s === 1)).toHaveLength(17);
    expect(strokes[siValues.indexOf(18)]).toBe(0);
  });

  it("Playing Handicap = 18: los 18 hoyos reciben exactamente 1 golpe cada uno", () => {
    const strokes = siValues.map((si) => strokesReceivedOnHole(18, si));
    expect(strokes.every((s) => s === 1)).toBe(true);
  });

  it("Playing Handicap > 18 (20): los hoyos de SI 1 y 2 reciben un segundo golpe", () => {
    const strokes = siValues.map((si) => strokesReceivedOnHole(20, si));
    expect(strokes[siValues.indexOf(1)]).toBe(2);
    expect(strokes[siValues.indexOf(2)]).toBe(2);
    expect(strokes.filter((s) => s === 2)).toHaveLength(2);
    expect(strokes.filter((s) => s === 1)).toHaveLength(16);
  });

  it("segundo ciclo de golpes: Playing Handicap 38 da un tercer golpe extra en SI 1 y 2", () => {
    const strokes = siValues.map((si) => strokesReceivedOnHole(38, si));
    expect(strokes[siValues.indexOf(1)]).toBe(3);
    expect(strokes[siValues.indexOf(2)]).toBe(3);
    expect(strokes.filter((s) => s === 3)).toHaveLength(2);
    expect(strokes.filter((s) => s === 2)).toHaveLength(16);
  });
});
