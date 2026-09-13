import { describe, expect, it } from "vitest";
import { averageMoodScore, mentalStateFromScore, moodTrend } from "./mood";

const labels = {
  hole: (n: number) => `Hoyo ${n}`,
  checkin: (n: number) => `Check-in ${n}`,
};

describe("moodTrend", () => {
  it("etiqueta cada punto con el hoyo o un check-in genérico", () => {
    const trend = moodTrend(
      [
        { mood: "NERVIOSO", hole: { number: 3 } },
        { mood: "CONFIADO", hole: null },
      ],
      labels
    );

    expect(trend[0]).toMatchObject({ label: "Hoyo 3", mood: "NERVIOSO" });
    expect(trend[1]).toMatchObject({ label: "Check-in 2", mood: "CONFIADO" });
  });
});

describe("averageMoodScore", () => {
  it("devuelve null sin entradas", () => {
    expect(averageMoodScore([])).toBeNull();
  });

  it("promedia la puntuación heurística de las entradas", () => {
    const avg = averageMoodScore([{ mood: "CONFIADO" }, { mood: "FRUSTRADO" }]);
    expect(avg).toBe(0);
  });
});

describe("mentalStateFromScore", () => {
  it("mapea el score a un estado cualitativo por umbrales", () => {
    expect(mentalStateFromScore(80)).toBe("strong");
    expect(mentalStateFromScore(75)).toBe("strong");
    expect(mentalStateFromScore(60)).toBe("composed");
    expect(mentalStateFromScore(40)).toBe("uneven");
    expect(mentalStateFromScore(10)).toBe("rough");
  });
});
