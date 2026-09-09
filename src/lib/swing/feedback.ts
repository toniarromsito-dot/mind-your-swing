import { anthropic, COACH_MODEL } from "@/lib/anthropic";
import type { SwingMetrics } from "./scoring";
import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * Convierte las métricas ya calculadas (números) en feedback en lenguaje
 * natural. Claude nunca ve el vídeo ni ninguna imagen: solo estos
 * números, para que quede claro que la puntuación viene de la heurística
 * de pose estimation (ver scoring.ts) y Claude únicamente la traduce a
 * texto útil y motivador.
 */
export async function generateSwingFeedback(metrics: SwingMetrics, locale: Locale): Promise<string> {
  const languageNote = locale === "en" ? "Respond in English." : "Responde en español.";

  const metricsBlock = [
    `Puntuación global: ${metrics.overallScore}/100`,
    `Estabilidad de la cabeza: ${metrics.headStability.score}/100`,
    `Mantenimiento del ángulo de columna: ${metrics.spineAngle.score}/100 (desviación máxima estimada: ${metrics.spineAngle.maxDeviationDegrees}°)`,
    `Rango de rotación de caderas: ${metrics.hipRotation.score}/100`,
    `Transferencia de peso hacia el impacto: ${metrics.weightTransfer.score}/100`,
    metrics.tempo.available
      ? `Tempo subida:bajada: ${metrics.tempo.score}/100 (ratio estimado ${metrics.tempo.ratio}:1, ideal ≈ 3:1)`
      : `Tempo: no se pudo estimar con claridad en este vídeo`,
  ].join("\n");

  const systemPrompt = `Eres el coach de "Mind Your Swing". Acabas de recibir una puntuación automática (0-100) del swing de un jugador, calculada por un algoritmo de visión por ordenador que analiza el movimiento del cuerpo en el vídeo (no por ti: tú nunca ves el vídeo).

Tu tarea: explica esta puntuación en 4-6 frases, en un tono cercano y motivador, cubriendo:
- Qué significa la puntuación global de forma sencilla.
- 1-2 puntos fuertes claros según las métricas (los de puntuación más alta).
- 1-2 aspectos a mejorar, con una indicación práctica y concreta para cada uno, sin sonar a regañina.
- Deja claro que esto es una ESTIMACIÓN AUTOMÁTICA orientativa (no un diagnóstico preciso ni una corrección profesional), y que si quiere un análisis más fino puede pedir revisión manual.

No inventes datos que no estén en las métricas. No repitas los números en crudo como una lista técnica: intégralos de forma natural. ${languageNote}`;

  const message = await anthropic.messages.create({
    model: COACH_MODEL,
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Métricas de este swing:\n${metricsBlock}`,
      },
    ],
  });

  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
