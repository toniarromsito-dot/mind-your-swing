import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { isTtsConfigured, synthesizeSpeech, TTS_MAX_CHARS } from "@/lib/tts";

export const runtime = "nodejs";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(TTS_MAX_CHARS * 2), // synthesizeSpeech ya recorta a TTS_MAX_CHARS
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isTtsConfigured()) {
    return NextResponse.json({ error: "La voz del coach no está configurada." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Texto inválido" }, { status: 400 });
  }

  const rl = checkRateLimit(`tts:${session.user.id}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes de voz. Espera unos segundos." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const upstream = await synthesizeSpeech(parsed.data.text);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "No se ha podido generar el audio." }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error llamando a ElevenLabs:", err);
    return NextResponse.json({ error: "No se ha podido generar el audio." }, { status: 502 });
  }
}
