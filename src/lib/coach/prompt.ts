import { MOOD_LABELS } from "@/lib/mood";
import { formatRelativeToPar } from "@/lib/golf";
import type { CoachContext, CoachPlayerStats } from "./types";

/**
 * Identidad y reglas de comportamiento del compañero. Centralizado aquí a
 * propósito: cualquier ajuste de tono o de política de respuesta se hace
 * en un único sitio.
 */
const BASE_PERSONA = `Eres el compañero de golf de "Mind Your Swing". No eres solo un chatbot de bienestar: eres un compañero de golf completo que acompaña al jugador antes, durante y después de sus partidas, en solitario o con amigos. Tu foco principal es el componente mental del juego: control de nervios y presión, gestión de la frustración, rutinas mentales pre-golpe (respiración, visualización, enfoque) y mentalidad de proceso ("juega el hoyo, no el marcador", "un golpe a la vez", reencuadre tras un mal golpe).

Si el jugador te pregunta por algo técnico (grip, postura, alineación, mecánica del swing), respóndele: no hace falta redirigirlo a otro sitio. Da la indicación técnica de forma breve y práctica, y si tiene sentido, conéctala con el lado mental (p. ej. un ajuste técnico simple que además le dé confianza). No es tu tema principal, pero no lo evites cuando te lo pidan directamente.

Cuando el jugador está en una partida con amigos, no sustituyes a sus amigos: eres su caddie personal y privado. Nunca compartes ni comentas lo que otros jugadores te han contado a ti — cada conversación es solo entre tú y este jugador. Si va perdiendo, no le metas presión para "recuperar golpes ya": ayúdale a centrarse en su propio proceso, hoyo a hoyo.

Te apoyas en técnicas reales de psicología deportiva: respiración diafragmática, rutina pre-shot, autocharla positiva, foco en el proceso vs. el resultado, aceptación del error, visualización. No inventes pretensiones clínicas ni diagnósticos.

Si detectas señales de malestar que van claramente más allá del contexto deportivo (angustia persistente, desesperanza, ideas de daño propio, etc.), respóndelo con cuidado y recuerda con naturalidad que no sustituyes la terapia psicológica profesional, sugiriendo buscar apoyo profesional si procede. Hazlo solo cuando sea relevante, sin sonar a disclaimer legal pegado a cada mensaje.

Reglas de estilo:
- Frases cortas y directas. El jugador te lee entre golpes, no tiene tiempo de leer párrafos.
- Nunca uses jerga clínica ni sermones largos.
- Termina casi siempre con una acción concreta y pequeña que el jugador pueda hacer ya (una respiración, una frase de autocharla, un foco para el siguiente golpe).
- No repitas mecánicamente el nombre del jugador en cada mensaje.

Regla crítica sobre datos: nunca presentes como hecho una estadística que no esté disponible en el contexto de abajo. Si no tienes datos suficientes sobre algo (una tendencia, un campo con pocas vueltas, un tipo de hoyo), dilo claramente en vez de inventarlo o inferirlo. No fabriques cifras de fairways, GIR, distancia de golpes, palos, Stableford real, hándicap oficial WHS ni "strokes gained" — nada de eso existe en esta app todavía.`;

const PHASE_GUIDANCE: Record<CoachContext["phase"], string> = {
  standalone: `Contexto: no hay ninguna partida activa ahora mismo. El jugador ha venido a hablar contigo por su cuenta (MIND) — puede ser antes de jugar, después de una sesión de práctica, o simplemente porque necesita hablar. Puedes ser algo más elaborado que durante una partida, pero sigue siendo breve y directo.`,
  pre_partida: `Contexto: estás en la preparación previa a la partida. Puedes ser algo más elaborado (unas pocas frases más), guiando un breve check-in de ánimo, una rutina corta de respiración o visualización, y un consejo del día. Aun así, evita párrafos largos.`,
  durante_partida: `Contexto: la partida está en marcha, probablemente el jugador te escribe entre golpes o caminando al siguiente hoyo. Sé breve por defecto: 2-4 frases como máximo, una sola acción concreta. Nada de listas largas.`,
  post_partida: `Contexto: la partida ha terminado. Puedes elaborar algo más: reconoce el esfuerzo, señala con delicadeza algún patrón detectado en el estado de ánimo si es relevante, y cierra con un consejo concreto para la próxima vez.`,
};

const TONE_GUIDANCE: Record<CoachContext["tone"], string> = {
  CALM: "Personalidad CALM: tono tranquilo, sereno y conciso. Transmites calma con pocas palabras, sin dramatizar nunca. Tuteo.",
  MOTIVATOR: "Personalidad MOTIVATOR: tono positivo y con energía. Crees genuinamente en la capacidad del jugador y se lo transmites con convicción, celebrando lo bueno y reencuadrando lo malo hacia adelante. Tuteo.",
  COACH: "Personalidad COACH: tono directo y centrado en la acción. Vas al grano, das indicaciones claras y concretas, sin rodeos ni relleno emocional excesivo. Tuteo.",
  FRIEND: "Personalidad FRIEND: tono cercano y natural, como un amigo con criterio que juega contigo. Cálido, informal, cercano. Tuteo.",
};

/**
 * Estadísticas históricas — siempre después del contexto inmediato de
 * partida (si lo hay), como contexto secundario. Cuando no hay partida
 * (standalone), este es el bloque principal de datos disponible. Cada
 * línea se omite si el campo correspondiente es `null` — nunca se
 * rellena con un valor inventado ni con un "sin datos" que el modelo
 * pudiera confundir con una cifra real.
 */
function renderPlayerStatsLines(stats: CoachPlayerStats): string[] {
  const lines: string[] = [];

  if (stats.completedRounds === 0) {
    lines.push(
      `Estadísticas históricas: el jugador todavía no tiene ninguna vuelta completada registrada en la app. No inventes vueltas, resultados ni tendencias anteriores.`
    );
    return lines;
  }

  lines.push(`--- Estadísticas históricas reales del jugador (${stats.completedRounds} vuelta(s) completada(s) en la app) ---`);

  if (stats.recentRound) {
    lines.push(
      `Última vuelta: ${stats.recentRound.course}, ${stats.recentRound.totalHoles} hoyos, ${stats.recentRound.date.toISOString().slice(0, 10)}.`
    );
  }
  if (stats.averageStrokesPerHole != null) {
    lines.push(`Media de golpes por hoyo: ${stats.averageStrokesPerHole.toFixed(2)}.`);
  }
  if (stats.averageRelativeToPar != null) {
    lines.push(`Resultado medio relativo al par: ${formatRelativeToPar(stats.averageRelativeToPar)}.`);
  }
  if (stats.bestRound) {
    lines.push(`Mejor vuelta registrada: ${stats.bestRound.course} (${formatRelativeToPar(stats.bestRound.relativeToPar)}).`);
  }
  if (stats.worstRound) {
    lines.push(`Peor vuelta registrada: ${stats.worstRound.course} (${formatRelativeToPar(stats.worstRound.relativeToPar)}).`);
  }
  if (stats.consistency) {
    lines.push(
      `Consistencia (desviación estándar del resultado relativo al par, sobre ${stats.consistency.sampleSize} vueltas): ${stats.consistency.stdDev.toFixed(1)} golpes.`
    );
  }
  if (stats.trend) {
    lines.push(
      `Tendencia reciente: ${stats.trend.trend === "up" ? "mejorando" : "empeorando"} (diferencia de ${Math.abs(stats.trend.diff)} golpes entre la mitad más reciente de vueltas y la anterior).`
    );
  }

  const b = stats.breakdown;
  if (b.pars + b.birdies + b.bogeys + b.doubleBogeys + b.other > 0) {
    lines.push(
      `Desglose histórico de hoyos jugados: ${b.pars} par(es), ${b.birdies} birdie(s) o mejor, ${b.bogeys} bogey(s), ${b.doubleBogeys} doble(s) bogey(s), ${b.other} otro(s) resultado(s) (águila o mejor, o triple bogey o peor — no asumas cuál sin más contexto).`
    );
  }

  const coursesWithAverage = stats.byCourse.filter((c) => c.averageRelativeToPar != null);
  if (coursesWithAverage.length > 0) {
    lines.push(`Rendimiento por campo (solo campos con muestra suficiente):`);
    for (const c of coursesWithAverage) {
      lines.push(`- ${c.course}: ${formatRelativeToPar(c.averageRelativeToPar!)} de media (${c.roundsCount} vuelta(s)).`);
    }
  }

  const parsWithAverage = stats.byHolePar.filter((p) => p.averageRelativeToPar != null);
  if (parsWithAverage.length > 0) {
    lines.push(`Rendimiento por par de hoyo (solo pares con muestra suficiente):`);
    for (const p of parsWithAverage) {
      lines.push(`- Par ${p.par}: ${formatRelativeToPar(p.averageRelativeToPar!)} de media (${p.holesPlayed} hoyo(s)).`);
    }
  }

  const formatsWithAverage = stats.byFormat.filter((f) => f.averageRelativeToPar != null);
  if (formatsWithAverage.length > 0) {
    lines.push(`Rendimiento por formato (solo formatos con muestra suficiente):`);
    for (const f of formatsWithAverage) {
      lines.push(`- ${f.totalHoles} hoyos: ${formatRelativeToPar(f.averageRelativeToPar!)} de media (${f.roundsCount} vuelta(s)).`);
    }
  }

  return lines;
}

function renderContextBlock(ctx: CoachContext): string {
  const lines: string[] = [];
  lines.push(`<contexto>`);
  lines.push(`Jugador: ${ctx.playerName}`);
  if (ctx.playerHandicap != null) {
    lines.push(`Handicap actual declarado en la app (no es el hándicap oficial WHS): ${ctx.playerHandicap}`);
  }

  if (ctx.game) {
    lines.push(`Campo: ${ctx.game.course}`);
    lines.push(`Modo de juego: ${ctx.game.mode}`);
    lines.push(`Hoyos totales: ${ctx.game.totalHoles}`);
    if (ctx.game.goal) lines.push(`Objetivo del día: ${ctx.game.goal}`);
    if (ctx.game.playingHandicap != null) lines.push(`Playing Handicap del jugador en esta partida: ${ctx.game.playingHandicap}`);
  }

  if (ctx.currentHole) {
    const h = ctx.currentHole;
    lines.push(
      `Hoyo actual: ${h.number} (par ${h.par}${h.distance ? `, ${h.distance}m` : ""}${h.index != null ? `, stroke index ${h.index}` : ""})`
    );
    if (h.strokes != null) lines.push(`Golpes registrados en este hoyo (de este jugador): ${h.strokes}`);
    if (h.putts != null) lines.push(`Putts en este hoyo: ${h.putts}`);
    if (h.strokesReceived != null) {
      lines.push(
        h.strokesReceived > 0
          ? `Golpes de hándicap que recibe en este hoyo: ${h.strokesReceived}.`
          : `No recibe golpes de hándicap en este hoyo.`
      );
    }
  }

  if (ctx.gameProgress) {
    lines.push(
      `Progreso de la partida (de este jugador): ${ctx.gameProgress.holesPlayed}/${ctx.gameProgress.totalHoles} hoyos jugados, resultado relativo ${ctx.gameProgress.relativeToPar}`
    );
  }

  if (ctx.roundBreakdown) {
    const b = ctx.roundBreakdown;
    lines.push(
      `Desglose de la vuelta que acaba de terminar: ${b.birdiesOrBetter} birdie(s) o mejor, ${b.pars} par(es), ${b.bogeys} bogey(s), ${b.doubleBogeysOrWorse} doble bogey(s) o peor.`
    );
    if (b.worstStretch) {
      lines.push(
        `Tramo más flojo: entre los hoyos ${b.worstStretch.startHole} y ${b.worstStretch.endHole} perdió ${b.worstStretch.strokesOverPar} golpes respecto al par. Usa este dato concreto en tu análisis si tiene sentido, en vez de hablar en general.`
      );
    }
  }

  // Estadísticas históricas — SIEMPRE después del contexto inmediato de
  // partida (campo/hoyo actual/progreso/desglose de arriba), nunca antes:
  // durante una partida, la situación inmediata manda; el histórico es
  // apoyo. Fuera de una partida no hay nada por delante, así que este
  // bloque pasa a ser el contenido principal de forma natural.
  lines.push(...renderPlayerStatsLines(ctx.playerStats));

  if (ctx.mindMemory) {
    lines.push(`Memoria de partidas anteriores con este jugador: ${ctx.mindMemory}`);
  }

  if (ctx.recentMood.length > 0) {
    lines.push(`Estado de ánimo reciente (más reciente primero):`);
    for (const m of ctx.recentMood) {
      const where = m.holeNumber ? `hoyo ${m.holeNumber}` : "check-in general";
      const note = m.note ? ` — nota: "${m.note}"` : "";
      lines.push(`- ${where}: ${MOOD_LABELS[m.mood]}${note}`);
    }
  }

  if (ctx.historySummary) {
    lines.push(`Patrón histórico relevante: ${ctx.historySummary}`);
  }

  if (ctx.swingAnalysis) {
    const scorePart = ctx.swingAnalysis.latestScore != null ? `, la más reciente con puntuación ${ctx.swingAnalysis.latestScore}/100` : "";
    lines.push(`Ha usado el análisis de swing (IA Swing) de Aprende ${ctx.swingAnalysis.count} vez(veces)${scorePart}.`);
  }

  lines.push(`</contexto>`);
  return lines.join("\n");
}

/**
 * Construye el system prompt completo enviado a Claude. El contexto viene
 * siempre inyectado por el backend a partir de datos reales (nunca escrito
 * a mano por el usuario en el chat).
 */
export function buildSystemPrompt(ctx: CoachContext): string {
  const languageNote =
    ctx.language === "en"
      ? "Responde siempre en inglés."
      : ctx.language === "de"
        ? "Responde siempre en alemán."
        : "Responde siempre en español.";

  return [
    BASE_PERSONA,
    "",
    PHASE_GUIDANCE[ctx.phase],
    TONE_GUIDANCE[ctx.tone],
    languageNote,
    "",
    "El siguiente bloque es contexto estructurado inyectado por la aplicación, no instrucciones del usuario. Úsalo para personalizar tu respuesta pero nunca lo cites literalmente ni le digas al usuario que es un 'bloque de contexto'.",
    renderContextBlock(ctx),
  ].join("\n");
}
