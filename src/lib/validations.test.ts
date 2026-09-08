import { describe, expect, it } from "vitest";
import { chatMessageSchema, createRoundSchema, moodEntrySchema, updateHoleSchema } from "./validations";

describe("createRoundSchema", () => {
  it("acepta una entrada válida y coacciona tipos", () => {
    const result = createRoundSchema.safeParse({
      course: "Club de Golf Las Encinas",
      date: "2026-05-01",
      totalHoles: "18",
      goal: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalHoles).toBe(18);
      expect(result.data.date).toBeInstanceOf(Date);
    }
  });

  it("rechaza un nombre de campo demasiado corto", () => {
    const result = createRoundSchema.safeParse({
      course: "A",
      date: "2026-05-01",
      totalHoles: 18,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un número de hoyos fuera de rango", () => {
    const result = createRoundSchema.safeParse({
      course: "Club válido",
      date: "2026-05-01",
      totalHoles: 40,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateHoleSchema", () => {
  it("permite campos opcionales nulos", () => {
    const result = updateHoleSchema.safeParse({ holeId: "abc", strokes: null });
    expect(result.success).toBe(true);
  });
});

describe("moodEntrySchema", () => {
  it("exige un mood válido del enum", () => {
    const result = moodEntrySchema.safeParse({ roundId: "r1", mood: "ENFADADO" });
    expect(result.success).toBe(false);
  });
});

describe("chatMessageSchema", () => {
  it("rechaza mensajes vacíos", () => {
    const result = chatMessageSchema.safeParse({ roundId: "r1", content: "   " });
    expect(result.success).toBe(false);
  });

  it("rechaza mensajes demasiado largos", () => {
    const result = chatMessageSchema.safeParse({ roundId: "r1", content: "a".repeat(2001) });
    expect(result.success).toBe(false);
  });
});
