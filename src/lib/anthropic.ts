import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configurable por variable de entorno para poder cambiar de modelo sin tocar código.
export const COACH_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

export const COACH_MAX_TOKENS = 500;
