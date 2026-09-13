"use server";

import { auth } from "@/lib/auth";
import { anthropic, COACH_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/coach/prompt";
import { getCoachContext } from "@/lib/coach/context";
import { checkRateLimit } from "@/lib/rate-limit";

// Tarjetas cortas, no una conversación: max_tokens bajo a propósito, muy
// por debajo de COACH_MAX_TOKENS del chat completo (500). No se guardan
// como Message — son efímeras, para no llenar el historial del chat
// completo con fragmentos de partida (ver /mind, coach-chat.tsx).
const QUICK_CARD_MAX_TOKENS = 150;

export async function getQuickCoachCard(
  gameId: string,
  holeId: string | null,
  prompt: string
): Promise<{ text: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "No autenticado" };
  const userId = session.user.id;

  const rl = checkRateLimit(userId);
  if (!rl.allowed) return { error: "Espera unos segundos antes de pedir otra." };

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "El coach no está disponible ahora mismo." };
  }

  try {
    const ctx = await getCoachContext({ userId, gameId, holeId });
    const systemPrompt = buildSystemPrompt(ctx);

    const message = await anthropic.messages.create(
      {
        model: COACH_MODEL,
        max_tokens: QUICK_CARD_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      },
      { timeout: 20_000 }
    );

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return { error: "El coach no ha podido responder. Inténtalo de nuevo." };
    return { text };
  } catch {
    return { error: "El coach no ha podido responder. Inténtalo de nuevo." };
  }
}
