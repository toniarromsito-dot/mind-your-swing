import { describe, expect, it } from "vitest";
import { chatMessageSchema, createGameSchema, moodEntrySchema, saveScoreSchema } from "./validations";

describe("createGameSchema", () => {
  it("acepta una entrada válida y coacciona tipos", () => {
    const result = createGameSchema.safeParse({
      playerCount: "2",
      mode: "STROKE_PLAY",
      courseId: "course-1",
      date: "2026-05-01",
      goal: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.playerCount).toBe(2);
      expect(result.data.date).toBeInstanceOf(Date);
    }
  });

  it("rechaza un número de jugadores fuera de rango", () => {
    const result = createGameSchema.safeParse({
      playerCount: 6,
      mode: "STROKE_PLAY",
      courseId: "course-1",
      date: "2026-05-01",
    });
    expect(result.success).toBe(false);
  });

  it("exige un modo de juego válido del enum", () => {
    const result = createGameSchema.safeParse({
      playerCount: 2,
      mode: "SCRAMBLED_EGGS",
      courseId: "course-1",
      date: "2026-05-01",
    });
    expect(result.success).toBe(false);
  });

  it("requiere courseId o un nombre de campo libre", () => {
    const withoutCourse = createGameSchema.safeParse({
      playerCount: 2,
      mode: "STROKE_PLAY",
      date: "2026-05-01",
    });
    expect(withoutCourse.success).toBe(false);

    const withFreeText = createGameSchema.safeParse({
      playerCount: 1,
      mode: "SOLO",
      course: "Campo cualquiera",
      date: "2026-05-01",
    });
    expect(withFreeText.success).toBe(true);
  });
});

describe("saveScoreSchema", () => {
  it("permite campos opcionales nulos", () => {
    const result = saveScoreSchema.safeParse({ holeId: "abc", strokes: null });
    expect(result.success).toBe(true);
  });

  it("rechaza golpes fuera de rango", () => {
    const result = saveScoreSchema.safeParse({ holeId: "abc", strokes: 30 });
    expect(result.success).toBe(false);
  });
});

describe("moodEntrySchema", () => {
  it("exige un mood válido del enum", () => {
    const result = moodEntrySchema.safeParse({ gameId: "g1", mood: "ENFADADO" });
    expect(result.success).toBe(false);
  });

  it("gameId es opcional (check-in fuera de una partida)", () => {
    const result = moodEntrySchema.safeParse({ mood: "TRANQUILO" });
    expect(result.success).toBe(true);
  });
});

describe("chatMessageSchema", () => {
  it("rechaza mensajes vacíos", () => {
    const result = chatMessageSchema.safeParse({ gameId: "g1", content: "   " });
    expect(result.success).toBe(false);
  });

  it("rechaza mensajes demasiado largos", () => {
    const result = chatMessageSchema.safeParse({ gameId: "g1", content: "a".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("gameId es opcional (chat standalone en MIND)", () => {
    const result = chatMessageSchema.safeParse({ content: "Hola" });
    expect(result.success).toBe(true);
  });
});
