import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";
import type { CoachContext } from "./types";

const baseContext: CoachContext = {
  phase: "durante_partida",
  playerName: "Ana",
  tone: "FRIEND",
  language: "es",
  game: { course: "Club de Golf Las Encinas", totalHoles: 18, goal: "Disfrutar", mode: "STROKE_PLAY" },
  currentHole: { number: 7, par: 3, distance: 150, strokes: null, putts: null },
  gameProgress: { holesPlayed: 6, totalHoles: 18, relativeToPar: "+2" },
  recentMood: [{ mood: "NERVIOSO", note: "manos frías", holeNumber: 6 }],
  historySummary: "Suele registrar nerviosismo en hoyos par 3.",
  mindMemory: null,
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
});
