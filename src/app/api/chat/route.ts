import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chatMessageSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { anthropic, COACH_MAX_TOKENS, COACH_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/coach/prompt";
import { getCoachContext } from "@/lib/coach/context";

export const runtime = "nodejs";

const HISTORY_LIMIT = 30;

// NDJSON: cada línea es un evento { type: "token" | "error" | "done", ... }
function ndjson(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const { roundId, holeId, content } = parsed.data;

  const rl = checkRateLimit(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Estás enviando mensajes demasiado rápido. Espera unos segundos." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let systemPrompt: string;
  try {
    const ctx = await getCoachContext({ userId, roundId, holeId });
    systemPrompt = buildSystemPrompt(ctx);
  } catch {
    return NextResponse.json({ error: "Ronda no encontrada" }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "El coach no está disponible: falta configurar ANTHROPIC_API_KEY en el servidor." },
      { status: 503 }
    );
  }

  await prisma.message.create({
    data: { userId, roundId, role: "USER", content },
  });

  const history = await prisma.message.findMany({
    where: { roundId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        const anthropicStream = anthropic.messages.stream({
          model: COACH_MODEL,
          max_tokens: COACH_MAX_TOKENS,
          system: systemPrompt,
          messages: history.map((m) => ({
            role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          })),
        });

        anthropicStream.on("text", (text) => {
          full += text;
          controller.enqueue(ndjson({ type: "token", text }));
        });

        await anthropicStream.finalMessage();
        controller.enqueue(ndjson({ type: "done" }));
      } catch (err) {
        console.error("Error llamando a Anthropic:", err);
        controller.enqueue(
          ndjson({
            type: "error",
            message: "El coach no ha podido responder. Inténtalo de nuevo en unos segundos.",
          })
        );
      } finally {
        if (full.trim().length > 0) {
          await prisma.message.create({
            data: { userId, roundId, role: "ASSISTANT", content: full },
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
