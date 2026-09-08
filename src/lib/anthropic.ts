import Anthropic from "@anthropic-ai/sdk";

// Algunas API keys (p. ej. las creadas a nivel de organización, no de un
// workspace concreto) exigen indicar a qué workspace pertenece la llamada.
// ANTHROPIC_WORKSPACE_ID es opcional: solo hace falta si la consola de
// Anthropic pide la cabecera "anthropic-workspace-id" para tu key.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
    ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
    : undefined,
});

// Configurable por variable de entorno para poder cambiar de modelo sin tocar código.
export const COACH_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

export const COACH_MAX_TOKENS = 500;
