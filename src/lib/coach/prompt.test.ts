import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";
import type { CoachContext, CoachPlayerStats } from "./types";

const EMPTY_PLAYER_STATS: CoachPlayerStats = {
  completedRounds: 0,
  recentRound: null,
  bestRound: null,
  worstRound: null,
  averageStrokesPerHole: null,
  averageRelativeToPar: null,
  consistency: null,
  trend: null,
  breakdown: { pars: 0, birdies: 0, bogeys: 0, doubleBogeys: 0, other: 0 },
  byCourse: [],
  byHolePar: [],
  byFormat: [],
};

const baseContext: CoachContext = {
  phase: "durante_partida",
  playerName: "Ana",
  tone: "FRIEND",
  language: "es",
  playerHandicap: null,
  game: { course: "Club de Golf Las Encinas", totalHoles: 18, goal: "Disfrutar", mode: "STROKE_PLAY", playingHandicap: null },
  currentHole: { number: 7, par: 3, distance: 150, strokes: null, putts: null, index: null, strokesReceived: null },
  gameProgress: { holesPlayed: 6, totalHoles: 18, relativeToPar: "+2" },
  recentMood: [{ mood: "NERVIOSO", note: "manos frías", holeNumber: 6 }],
  historySummary: "Suele registrar nerviosismo en hoyos par 3.",
  mindMemory: null,
  swingAnalysis: null,
  playerStats: EMPTY_PLAYER_STATS,
};

describe("buildSystemPrompt", () => {
  it("incluye el contexto estructurado real, nunca inventado", () => {
    const prompt = buildSystemPrompt(baseContext);

    expect(prompt).toContain("Club de Golf Las Encinas");
    expect(prompt).toContain("Hoyo actual: 7 (par 3, 150m)");
    expect(prompt).toContain("6/18 hoyos jugados, resultado relativo +2");
    expect(prompt).toContain("Nervioso");
    expect(prompt).toContain("manos frías");
    expect(prompt).toContain("Suele registrar nerviosismo en hoyos par 3.");
  });

  it("usa un tono breve durante la partida y permite responder preguntas técnicas si se piden", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toMatch(/breve por defecto/i);
    expect(prompt).toMatch(/si el jugador te pregunta por algo técnico/i);
  });

  it("permite respuestas más elaboradas antes y después de la partida, y en modo standalone", () => {
    const prePartida = buildSystemPrompt({ ...baseContext, phase: "pre_partida" });
    const postPartida = buildSystemPrompt({ ...baseContext, phase: "post_partida" });
    const standalone = buildSystemPrompt({ ...baseContext, phase: "standalone", game: null, currentHole: null, gameProgress: null });

    expect(prePartida).toMatch(/preparación previa/i);
    expect(postPartida).toMatch(/ha terminado/i);
    expect(standalone).toMatch(/no hay ninguna partida activa/i);
  });

  it("respeta el idioma configurado", () => {
    const enPrompt = buildSystemPrompt({ ...baseContext, language: "en" });
    expect(enPrompt).toContain("Responde siempre en inglés.");
  });

  it("ajusta la personalidad del compañero", () => {
    const calm = buildSystemPrompt({ ...baseContext, tone: "CALM" });
    const coach = buildSystemPrompt({ ...baseContext, tone: "COACH" });
    const motivator = buildSystemPrompt({ ...baseContext, tone: "MOTIVATOR" });

    expect(calm).toMatch(/personalidad calm/i);
    expect(coach).toMatch(/personalidad coach/i);
    expect(motivator).toMatch(/personalidad motivator/i);
  });

  it("incluye el desglose de la vuelta y el tramo más flojo cuando están disponibles", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      phase: "post_partida",
      roundBreakdown: {
        birdiesOrBetter: 1,
        pars: 10,
        bogeys: 5,
        doubleBogeysOrWorse: 2,
        worstStretch: { startHole: 11, endHole: 14, strokesOverPar: 5 },
      },
    });
    expect(prompt).toContain("1 birdie(s) o mejor");
    expect(prompt).toContain("entre los hoyos 11 y 14 perdió 5 golpes");
  });

  it("incluye la memoria de Mind cuando existe (solo Pro)", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      mindMemory: "La semana pasada trabajamos la reacción tras un doble bogey.",
    });
    expect(prompt).toContain("La semana pasada trabajamos la reacción tras un doble bogey.");
  });

  it("incluye el uso real de IA Swing cuando existe, sin inventar un progreso de Aprende", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      swingAnalysis: { count: 3, latestScore: 82 },
    });
    expect(prompt).toContain("IA Swing");
    expect(prompt).toContain("3 vez(veces)");
    expect(prompt).toContain("82/100");
  });

  it("no menciona IA Swing cuando el jugador nunca la ha usado", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).not.toContain("IA Swing");
  });

  it("responde en alemán cuando el idioma del jugador es de", () => {
    const prompt = buildSystemPrompt({ ...baseContext, language: "de" });
    expect(prompt).toContain("Responde siempre en alemán.");
  });

  it("incluye la regla anti-invención en la personalidad base", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toMatch(/nunca presentes como hecho una estadística que no esté disponible/i);
    expect(prompt).toMatch(/fairways/i);
    expect(prompt).toMatch(/GIR/i);
    expect(prompt).toMatch(/strokes gained/i);
  });

  it("sin ninguna vuelta completada, lo dice explícitamente y no inventa cifras", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("el jugador todavía no tiene ninguna vuelta completada registrada en la app");
    expect(prompt).not.toContain("Media de golpes por hoyo");
    expect(prompt).not.toContain("Mejor vuelta registrada");
  });

  it("con estadísticas históricas suficientes, incluye cada bloque solo cuando el dato no es null", () => {
    const stats: CoachPlayerStats = {
      completedRounds: 5,
      recentRound: { course: "Son Muntaner", date: new Date("2026-09-01"), totalHoles: 18 },
      bestRound: { course: "Son Muntaner", date: new Date("2026-08-01"), relativeToPar: -1 },
      worstRound: { course: "Alcanada", date: new Date("2026-07-01"), relativeToPar: 12 },
      averageStrokesPerHole: 5.2,
      averageRelativeToPar: 8,
      consistency: { stdDev: 3.1, sampleSize: 5 },
      trend: { trend: "up", diff: -2.5 },
      breakdown: { pars: 20, birdies: 2, bogeys: 30, doubleBogeys: 10, other: 3 },
      byCourse: [
        { course: "Son Muntaner", roundsCount: 4, averageRelativeToPar: 7 },
        { course: "Un solo campo", roundsCount: 1, averageRelativeToPar: null }, // muestra insuficiente, no debe aparecer
      ],
      byHolePar: [
        { par: 3, holesPlayed: 10, averageRelativeToPar: 1.2 },
        { par: 5, holesPlayed: 2, averageRelativeToPar: null }, // muestra insuficiente
      ],
      byFormat: [{ totalHoles: 18, roundsCount: 5, averageRelativeToPar: 8 }],
    };
    const prompt = buildSystemPrompt({ ...baseContext, playerStats: stats });

    expect(prompt).toContain("5 vuelta(s) completada(s) en la app");
    expect(prompt).toContain("Son Muntaner, 18 hoyos, 2026-09-01");
    expect(prompt).toContain("Media de golpes por hoyo: 5.20");
    expect(prompt).toContain("Mejor vuelta registrada: Son Muntaner");
    expect(prompt).toContain("Peor vuelta registrada: Alcanada");
    expect(prompt).toContain("Consistencia");
    expect(prompt).toContain("mejorando");
    expect(prompt).toContain("20 par(es)");
    expect(prompt).toContain("- Son Muntaner: +7 de media (4 vuelta(s))");
    expect(prompt).not.toContain("Un solo campo"); // sin muestra suficiente, se omite del todo
    expect(prompt).toContain("- Par 3: +1.2 de media (10 hoyo(s))");
    expect(prompt).not.toContain("Par 5:"); // sin muestra suficiente
    expect(prompt).toContain("18 hoyos: +8 de media (5 vuelta(s))");
  });

  it("prioridad del contexto: durante_partida coloca partida/hoyo/progreso ANTES que las estadísticas históricas", () => {
    const stats: CoachPlayerStats = { ...EMPTY_PLAYER_STATS, completedRounds: 3, averageRelativeToPar: 6 };
    const prompt = buildSystemPrompt({ ...baseContext, phase: "durante_partida", playerStats: stats });

    const gameIdx = prompt.indexOf("Club de Golf Las Encinas");
    const holeIdx = prompt.indexOf("Hoyo actual");
    const progressIdx = prompt.indexOf("Progreso de la partida");
    const statsIdx = prompt.indexOf("Estadísticas históricas reales");

    expect(gameIdx).toBeGreaterThan(-1);
    expect(holeIdx).toBeGreaterThan(-1);
    expect(progressIdx).toBeGreaterThan(-1);
    expect(statsIdx).toBeGreaterThan(-1);
    expect(gameIdx).toBeLessThan(statsIdx);
    expect(holeIdx).toBeLessThan(statsIdx);
    expect(progressIdx).toBeLessThan(statsIdx);
  });

  it("fuera de partida (standalone), las estadísticas históricas son el contexto principal disponible", () => {
    const stats: CoachPlayerStats = { ...EMPTY_PLAYER_STATS, completedRounds: 4, averageRelativeToPar: 5 };
    const prompt = buildSystemPrompt({
      ...baseContext,
      phase: "standalone",
      game: null,
      currentHole: null,
      gameProgress: null,
      playerStats: stats,
    });

    expect(prompt).not.toContain("Campo:");
    expect(prompt).not.toContain("Hoyo actual");
    expect(prompt).toContain("Estadísticas históricas reales del jugador (4 vuelta(s)");
  });

  it("incluye el handicap declarado del jugador, dejando claro que no es el oficial WHS", () => {
    const prompt = buildSystemPrompt({ ...baseContext, playerHandicap: 18.4 });
    expect(prompt).toContain("Handicap actual declarado en la app (no es el hándicap oficial WHS): 18.4");
  });

  it("sin handicap declarado, no menciona ninguna cifra de hándicap del jugador", () => {
    const prompt = buildSystemPrompt({ ...baseContext, playerHandicap: null });
    expect(prompt).not.toContain("Handicap actual declarado");
  });

  it("incluye el Playing Handicap de la partida y el stroke index del hoyo cuando existen", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      game: { ...baseContext.game!, playingHandicap: 14 },
      currentHole: { ...baseContext.currentHole!, index: 3, strokesReceived: 1 },
    });
    expect(prompt).toContain("Playing Handicap del jugador en esta partida: 14");
    expect(prompt).toContain("stroke index 3");
    expect(prompt).toContain("Golpes de hándicap que recibe en este hoyo: 1.");
  });

  it("indica explícitamente cuando el jugador no recibe golpes de hándicap en el hoyo (no lo omite en silencio)", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      currentHole: { ...baseContext.currentHole!, index: 18, strokesReceived: 0 },
    });
    expect(prompt).toContain("No recibe golpes de hándicap en este hoyo.");
  });
});
