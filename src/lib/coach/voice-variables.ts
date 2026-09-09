import { MOOD_LABELS } from "@/lib/mood";
import type { CoachContext } from "./types";

/**
 * Aplana el CoachContext a variables {{ }} para el agente de voz de
 * ElevenLabs (Conversational AI). El agente las sustituye en su system
 * prompt antes de llamar a nuestro endpoint custom-llm — ver
 * src/app/api/voice/v1/chat/completions/route.ts.
 */
export function buildDynamicVariables(ctx: CoachContext): Record<string, string> {
  return {
    player_name: ctx.playerName,
    course: ctx.game?.course ?? "sin partida activa",
    hole_number: ctx.currentHole ? String(ctx.currentHole.number) : "sin hoyo activo",
    hole_par: ctx.currentHole ? String(ctx.currentHole.par) : "-",
    round_progress: ctx.gameProgress
      ? `${ctx.gameProgress.holesPlayed}/${ctx.gameProgress.totalHoles} hoyos jugados, resultado ${ctx.gameProgress.relativeToPar}`
      : "todavía no hay hoyos jugados en esta partida",
    recent_mood:
      ctx.recentMood.length > 0
        ? ctx.recentMood
            .map((m) => `${MOOD_LABELS[m.mood]}${m.note ? ` ("${m.note}")` : ""}`)
            .join(", ")
        : "sin check-ins recientes",
    language: ctx.language === "en" ? "inglés" : "español",
  };
}
