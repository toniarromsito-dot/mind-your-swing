import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCoachContext } from "@/lib/coach/context";
import { buildDynamicVariables } from "@/lib/coach/voice-variables";
import { canStartVoiceCall } from "@/lib/billing";

export const runtime = "nodejs";

const bodySchema = z.object({
  gameId: z.string().min(1).optional(),
  holeId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_AGENT_ID) {
    return NextResponse.json(
      { error: "La llamada de voz no está configurada." },
      { status: 503 }
    );
  }

  const rl = checkRateLimit(`voice-session:${session.user.id}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiadas llamadas seguidas. Espera unos segundos." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const usage = await canStartVoiceCall(session.user.id, user.plan);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: "Has usado todos los minutos de llamada de este mes.",
        code: "VOICE_LIMIT_REACHED",
        minutesUsed: usage.minutesUsed,
        minutesIncluded: usage.minutesIncluded,
      },
      { status: 402 }
    );
  }

  let dynamicVariables: Record<string, string>;
  try {
    const ctx = await getCoachContext({
      userId: session.user.id,
      gameId: parsed.data.gameId,
      holeId: parsed.data.holeId,
    });
    dynamicVariables = buildDynamicVariables(ctx);
  } catch {
    return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${process.env.ELEVENLABS_AGENT_ID}`,
      { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY } }
    );
    if (!upstream.ok) {
      return NextResponse.json({ error: "No se ha podido iniciar la llamada." }, { status: 502 });
    }
    const data = (await upstream.json()) as { signed_url: string };
    return NextResponse.json({ signedUrl: data.signed_url, dynamicVariables });
  } catch (err) {
    console.error("Error obteniendo signed URL de ElevenLabs:", err);
    return NextResponse.json({ error: "No se ha podido iniciar la llamada." }, { status: 502 });
  }
}
