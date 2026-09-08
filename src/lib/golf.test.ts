import { describe, expect, it } from "vitest";
import {
  formatRelativeToPar,
  holeResultLabel,
  holesPlayed,
  relativeToPar,
  totalStrokes,
} from "./golf";

describe("holeResultLabel", () => {
  it("etiqueta los resultados estándar", () => {
    expect(holeResultLabel(4, 3)).toBe("Birdie");
    expect(holeResultLabel(4, 4)).toBe("Par");
    expect(holeResultLabel(4, 5)).toBe("Bogey");
    expect(holeResultLabel(4, 6)).toBe("Doble bogey");
    expect(holeResultLabel(5, 2)).toBe("Albatross");
    expect(holeResultLabel(4, 2)).toBe("Eagle");
  });

  it("cae a formato +N/-N para resultados fuera de la tabla", () => {
    expect(holeResultLabel(4, 8)).toBe("+4");
  });
});

describe("totalStrokes / relativeToPar / holesPlayed", () => {
  const holes = [
    { number: 1, par: 4, strokes: 5 },
    { number: 2, par: 3, strokes: 3 },
    { number: 3, par: 5, strokes: null },
  ];

  it("suma solo los golpes de hoyos jugados", () => {
    expect(totalStrokes(holes)).toBe(8);
  });

  it("calcula el resultado relativo ignorando hoyos sin jugar", () => {
    expect(relativeToPar(holes)).toBe(1);
  });

  it("cuenta solo los hoyos con resultado", () => {
    expect(holesPlayed(holes)).toBe(2);
  });
});

describe("formatRelativeToPar", () => {
  it("formatea positivos, negativos y par", () => {
    expect(formatRelativeToPar(3)).toBe("+3");
    expect(formatRelativeToPar(-2)).toBe("-2");
    expect(formatRelativeToPar(0)).toBe("E");
  });
});
