/**
 * Resolución pura (sin Prisma) de qué hoyos copiar en una partida nueva a
 * partir del tee elegido — separada de createGame para poder testearla
 * igual que standings.ts/handicap.ts.
 *
 * Regla clave: nunca se inventan hoyos nuevos en el campo. Un recorrido
 * con 9 hoyos reales (Pollença, Santa Ponsa III, Palma Pitch & Putt)
 * sigue teniendo solo 9 filas en GolfCourseTeeHole — si el usuario pide
 * 18 hoyos, GameHole 10-18 son filas NUEVAS DE LA PARTIDA que clonan el
 * par/índice/distancia real de GameHole 1-9 (segunda vuelta del mismo
 * recorrido), nunca datos aproximados ni un nuevo hoyo de campo.
 */

export type TeeHoleInput = {
  number: number;
  par: number | null;
  index: number | null;
  distance: number | null;
};

export type ResolvedGameHole = {
  number: number;
  par: number;
  index: number | null;
  distance: number | null;
};

export type ResolveGameHolesResult = {
  holes: ResolvedGameHole[];
  effectiveHoleCount: 9 | 18;
  /** true cuando el recorrido solo tiene 9 hoyos reales y los 18 pedidos se han resuelto jugando esa misma tarjeta dos veces. */
  doubledNineHoles: boolean;
};

function toResolvedHole(h: TeeHoleInput, number: number): ResolvedGameHole {
  return { number, par: h.par ?? 4, index: h.index, distance: h.distance };
}

/**
 * A partir de los hoyos reales de un tee (GolfCourseTeeHole) y el número de
 * hoyos solicitado por el usuario, calcula qué hoyos copiar a la partida.
 * `par` que llega null se trata como 4 (no debería ocurrir con datos
 * verificados, pero Hole.par es NOT NULL en el schema).
 */
export function resolveGameHoles(teeHoles: TeeHoleInput[], requestedHoleCount: 9 | 18): ResolveGameHolesResult {
  const sorted = [...teeHoles].sort((a, b) => a.number - b.number);
  const realHoleCount = sorted.length >= 18 ? 18 : 9;

  if (realHoleCount === 18) {
    // Recorrido de 18 hoyos reales: "9 hoyos" son los 9 primeros, "18" son todos — sin duplicar nada.
    const holes = sorted.slice(0, requestedHoleCount).map((h, i) => toResolvedHole(h, i + 1));
    return { holes, effectiveHoleCount: requestedHoleCount, doubledNineHoles: false };
  }

  const nine = sorted.slice(0, 9);
  if (requestedHoleCount === 9) {
    const holes = nine.map((h, i) => toResolvedHole(h, i + 1));
    return { holes, effectiveHoleCount: 9, doubledNineHoles: false };
  }

  // 18 hoyos pedidos en un recorrido de 9 hoyos reales: segunda vuelta =
  // misma tarjeta (mismo par/índice/distancia real), como GameHole 10-18
  // nuevos de esta partida — GolfCourseTeeHole no gana ninguna fila.
  const firstLoop = nine.map((h, i) => toResolvedHole(h, i + 1));
  const secondLoop = nine.map((h, i) => toResolvedHole(h, i + 10));
  return { holes: [...firstLoop, ...secondLoop], effectiveHoleCount: 18, doubledNineHoles: true };
}
