import { anthropic, COACH_MAX_TOKENS, COACH_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";

type OpenAIMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Endpoint "Custom LLM" para el agente de voz de ElevenLabs Conversational
 * AI (ver src/lib/tts.ts y el README para el resto del flujo de voz).
 * ElevenLabs hace de STT+TTS y nos manda la conversación en formato
 * compatible con la API de OpenAI Chat Completions; nosotros generamos la
 * respuesta con el mismo Claude que usa el chat de texto, y la devolvemos
 * como Server-Sent Events con el formato exacto que espera ElevenLabs.
 *
 * Protegido con un secreto compartido (no con la sesión del usuario:
 * quien llama es el servidor de ElevenLabs, no el navegador).
 */
export async function POST(req: Request) {
  const expectedSecret = process.env.ELEVENLABS_CUSTOM_LLM_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { messages?: OpenAIMessage[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const messages = body.messages ?? [];
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const model = "mind-your-swing-voice";
  const encoder = new TextEncoder();

  function chunk(delta: Record<string, unknown>, finishReason: string | null = null) {
    return encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finishReason }],
      })}\n\n`
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(chunk({ role: "assistant", content: "" }));

        const anthropicStream = anthropic.messages.stream({
          model: COACH_MODEL,
          max_tokens: COACH_MAX_TOKENS,
          system: systemMessage?.content,
          messages:
            conversationMessages.length > 0
              ? conversationMessages
              : [{ role: "user", content: "Hola" }],
        });

        anthropicStream.on("text", (text) => {
          controller.enqueue(chunk({ content: text }));
        });

        await anthropicStream.finalMessage();
        controller.enqueue(chunk({}, "stop"));
      } catch (err) {
        console.error("Error en el custom LLM de voz:", err);
        controller.enqueue(
          chunk({ content: "Lo siento, no puedo responder ahora mismo." }, "stop")
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
