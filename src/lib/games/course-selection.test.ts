import { describe, expect, it } from "vitest";
import { groupTeesByColor, resolveGameHoles, type TeeForGrouping, type TeeHoleInput } from "./course-selection";

function makeHoles(count: number): TeeHoleInput[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
    index: i + 1,
    distance: 300 + i,
  }));
}

describe("resolveGameHoles", () => {
  it("uses all 18 real holes for an 18-hole layout when 18 is requested (e.g. Santa Ponsa I/II), without duplicating", () => {
    const result = resolveGameHoles(makeHoles(18), 18);
    expect(result.effectiveHoleCount).toBe(18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(false);
    expect(result.holes.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    // Sin duplicados: cada hoyo de un recorrido de 18 tiene par/índice/distancia propios.
    expect(new Set(result.holes.map((h) => h.distance)).size).toBe(18);
  });

  it("uses the first 9 real holes for an 18-hole layout when 9 is requested", () => {
    const result = resolveGameHoles(makeHoles(18), 9);
    expect(result.effectiveHoleCount).toBe(9);
    expect(result.holes).toHaveLength(9);
    expect(result.holes.map((h) => h.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.doubledNineHoles).toBe(false);
  });

  it("uses the real 9 holes for a genuinely 9-hole layout when 9 is requested (Pollença)", () => {
    const result = resolveGameHoles(makeHoles(9), 9);
    expect(result.effectiveHoleCount).toBe(9);
    expect(result.holes).toHaveLength(9);
    expect(result.doubledNineHoles).toBe(false);
  });

  it("Pollença a 18: juega la misma tarjeta de 9 dos veces como GameHole 1-18, sin inventar hoyos nuevos", () => {
    const nineHoleTee = makeHoles(9);
    const result = resolveGameHoles(nineHoleTee, 18);
    expect(result.effectiveHoleCount).toBe(18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(true);
    expect(result.holes.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    // GameHole 10-18 (segunda vuelta) tienen exactamente los mismos datos del tee real que 1-9.
    for (let i = 0; i < 9; i++) {
      const firstLoopHole = result.holes[i];
      const secondLoopHole = result.holes[i + 9];
      expect(secondLoopHole.par).toBe(firstLoopHole.par);
      expect(secondLoopHole.index).toBe(firstLoopHole.index);
      expect(secondLoopHole.distance).toBe(firstLoopHole.distance);
      expect(secondLoopHole.number).toBe(firstLoopHole.number + 9);
    }
  });

  it("Santa Ponsa III a 18: misma regla de segunda vuelta que Pollença", () => {
    const result = resolveGameHoles(makeHoles(9), 18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(true);
  });

  it("Palma Pitch & Putt a 18: misma regla de segunda vuelta", () => {
    const result = resolveGameHoles(makeHoles(9), 18);
    expect(result.holes).toHaveLength(18);
    expect(result.doubledNineHoles).toBe(true);
  });

  it("falls back par to 4 when a tee hole has no verified par", () => {
    const holes: TeeHoleInput[] = [{ number: 1, par: null, index: null, distance: null }];
    const result = resolveGameHoles(holes, 9);
    expect(result.holes[0]).toEqual({ number: 1, par: 4, index: null, distance: null });
  });

  it("sorts holes by number regardless of input order before doubling", () => {
    const nine = makeHoles(9);
    const shuffled = [nine[8], nine[0], nine[3], ...nine.slice(1, 3), ...nine.slice(4, 8)];
    const result = resolveGameHoles(shuffled, 18);
    expect(result.holes.map((h) => h.number)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(result.holes[0].distance).toBe(nine[0].distance);
    expect(result.holes[9].distance).toBe(nine[0].distance);
  });
});

function tee(id: string, name: string, category: string | null): TeeForGrouping {
  return { id, name, category };
}

// Datos reales de producción (Neon), tal cual — misma tee.name/category
// que hoy en pantalla, ver auditoría de Jugar. groupTeesByColor solo debe
// cambiar el orden de presentación, nunca el contenido.
const ALCANADA_12_TEES: TeeForGrouping[] = [
  tee("am-f", "AMARILLAS", "F"),
  tee("am-m", "AMARILLAS", "M"),
  tee("az-f", "AZULES", "F"),
  tee("az-m", "AZULES", "M"),
  tee("bl-f", "BLANCAS", "F"),
  tee("bl-m", "BLANCAS", "M"),
  tee("ro-m", "ROJAS", "M"),
  tee("ro-f", "ROJAS", "F"),
  tee("rs-m", "ROSAS", "M"),
  tee("rs-f", "ROSAS", "F"),
  tee("ve-m", "VERDES", "M"),
  tee("ve-f", "VERDES", "F"),
];

const SANTA_PONSA_II_6_TEES: TeeForGrouping[] = [
  tee("sp2-am-m", "AMARILLAS", "M"),
  tee("sp2-az-f", "AZULES", "F"),
  tee("sp2-az-m", "AZULES", "M"),
  tee("sp2-bl-m", "BLANCAS", "M"),
  tee("sp2-ro-f", "ROJAS", "F"),
  tee("sp2-ro-m", "ROJAS", "M"),
];

const POLLENCA_4_TEES: TeeForGrouping[] = [
  tee("pol-am-f", "AMARILLAS", "F"),
  tee("pol-am-m", "AMARILLAS", "M"),
  tee("pol-ro-f", "ROJAS", "F"),
  tee("pol-ro-m", "ROJAS", "M"),
];

describe("groupTeesByColor", () => {
  it("Alcanada (12 tees reales, 6 colores × M/F): agrupa por color sin perder ningún tee", () => {
    const groups = groupTeesByColor(ALCANADA_12_TEES);
    expect(groups.map((g) => g.colorName)).toEqual(["AMARILLAS", "AZULES", "BLANCAS", "ROJAS", "ROSAS", "VERDES"]);
    expect(groups.every((g) => g.tees.length === 2)).toBe(true);
    // Ningún tee se pierde ni se duplica.
    const allIds = groups.flatMap((g) => g.tees.map((t) => t.id));
    expect(allIds.sort()).toEqual(ALCANADA_12_TEES.map((t) => t.id).sort());
  });

  it("Alcanada: dentro de cada color, masculino antes que femenino — nunca mezclados", () => {
    const groups = groupTeesByColor(ALCANADA_12_TEES);
    for (const group of groups) {
      expect(group.tees.map((t) => t.category)).toEqual(["M", "F"]);
    }
  });

  it("Santa Ponsa II (6 tees reales): 4 colores, con colores de un solo género y otros con M+F", () => {
    const groups = groupTeesByColor(SANTA_PONSA_II_6_TEES);
    expect(groups.map((g) => g.colorName)).toEqual(["AMARILLAS", "AZULES", "BLANCAS", "ROJAS"]);
    expect(groups.find((g) => g.colorName === "AMARILLAS")!.tees.map((t) => t.category)).toEqual(["M"]);
    expect(groups.find((g) => g.colorName === "AZULES")!.tees.map((t) => t.category)).toEqual(["M", "F"]);
    expect(groups.find((g) => g.colorName === "BLANCAS")!.tees.map((t) => t.category)).toEqual(["M"]);
    expect(groups.find((g) => g.colorName === "ROJAS")!.tees.map((t) => t.category)).toEqual(["M", "F"]);
    // Los 6 tees siguen todos presentes.
    expect(groups.flatMap((g) => g.tees)).toHaveLength(6);
  });

  it("Pollença (4 tees reales, valor real de la base de datos): 2 colores, M antes que F en cada uno", () => {
    const groups = groupTeesByColor(POLLENCA_4_TEES);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.colorName)).toEqual(["AMARILLAS", "ROJAS"]);
    expect(groups.every((g) => g.tees.map((t) => t.category).join(",") === "M,F")).toBe(true);
  });

  it("no cambia ni renombra category — reconoce 'HOMBRES'/'MUJERES' (Santa Ponsa III, Palma Pitch & Putt) igual que 'M'/'F', sin tocar el valor guardado", () => {
    const tees: TeeForGrouping[] = [tee("spiii-f", "ROJAS", "MUJERES"), tee("spiii-m", "AMARILLAS", "HOMBRES")];
    const groups = groupTeesByColor(tees);
    // Se reconoce como femenino/masculino para el orden, pero el texto guardado no se toca.
    expect(groups.flatMap((g) => g.tees).map((t) => t.category)).toEqual(
      expect.arrayContaining(["MUJERES", "HOMBRES"])
    );
    const amarillas = groups.find((g) => g.colorName === "AMARILLAS")!;
    expect(amarillas.tees[0].category).toBe("HOMBRES");
  });

  it("un color con un único tee (sin pareja M/F) queda en su propio grupo de 1", () => {
    const tees: TeeForGrouping[] = [tee("unico", "BLANCAS", "M")];
    const groups = groupTeesByColor(tees);
    expect(groups).toEqual([{ colorName: "BLANCAS", tees: [tees[0]] }]);
  });

  it("devuelve una lista vacía sin fallar cuando el recorrido no tiene tees", () => {
    expect(groupTeesByColor([])).toEqual([]);
  });
});
