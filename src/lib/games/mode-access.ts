import type { GameMode, Plan } from "@prisma/client";
import { GAME_MODE_META } from "./modes";
import { canUseFeature } from "@/lib/entitlements";

/**
 * Única fuente de verdad para si un usuario puede crear (o heredar vía
 * revancha) una partida en `mode` — Fase 11A. El `disabled` del botón en
 * new-game-screen.tsx es solo UX; esta función es la que de verdad decide,
 * y se llama SIEMPRE server-side (createGame, createRematch), nunca a
 * partir de lo que mande el cliente. Lanza un Error con mensaje listo para
 * mostrar si el modo no está permitido; cada caller lo adapta a su propio
 * formato de error (ActionState con `{error}` o un throw directo, según
 * la convención ya establecida en cada función).
 */
export function assertModeAllowed(user: { plan: Plan; email: string | null }, mode: GameMode): void {
  if (GAME_MODE_META[mode].pro && !canUseFeature(user, "ADVANCED_GAME_CREATION")) {
    throw new Error("Este modo de juego requiere Mind Your Swing Pro.");
  }
}
