import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";
import type { CoachContext } from "./types";

const baseContext: CoachContext = {
  phase: "durante_ronda",
  playerName: "Ana",
  tone: "CERCANO",
  language: "es",
  round: { course: "Club de Golf Las Encinas", totalHoles: 18, goal: "Disfrutar" },
  currentHole: { number: 7, par: 3, distance: 150, strokes: null, putts: null },
  roundProgress: { holesPlayed: 6, totalHoles: 18, relativeToPar: "+2" },
  recentMood: [{ mood: "NERVIOSO", note: "manos frías", holeNumber: 6 }],
  historySummary: "Suele registrar nerviosismo en hoyos par 3.",
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

  it("usa un tono breve durante la ronda e instruye evitar mecánica de swing", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toMatch(/breve por defecto/i);
    expect(prompt).toMatch(/no eres un profesor técnico de swing/i);
  });

  it("permite respuestas más elaboradas antes y después de la ronda", () => {
    const preRonda = buildSystemPrompt({ ...baseContext, phase: "pre_ronda" });
    const postRonda = buildSystemPrompt({ ...baseContext, phase: "post_ronda" });

    expect(preRonda).toMatch(/preparación previa/i);
    expect(postRonda).toMatch(/ha terminado/i);
  });

  it("respeta el idioma configurado", () => {
    const enPrompt = buildSystemPrompt({ ...baseContext, language: "en" });
    expect(enPrompt).toContain("Responde siempre en inglés.");
  });

  it("ajusta el tono cercano vs. formal", () => {
    const formal = buildSystemPrompt({ ...baseContext, tone: "FORMAL" });
    expect(formal).toMatch(/tono más formal/i);
  });
});
