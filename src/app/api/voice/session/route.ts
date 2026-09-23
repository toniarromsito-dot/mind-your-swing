import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCoachContext } from "@/lib/coach/context";
import { buildDynamicVariables } from "@/lib/coach/voice-variables";
import { canStartVoiceCall } from "@/lib/billing";
import { getVoiceCreditStatus } from "@/lib/voice/credits";
import { isOwnerEmail } from "@/lib/admin";

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
  const owner = isOwnerEmail(user.email);
  if (!owner) {
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
  }

  // Hardening — sección "AGOTAMIENTO DE VOICE DURANTE LA LLAMADA": el saldo
  // disponible EN ESTE INSTANTE (foto de inicio de llamada), para que el
  // cliente pueda hacer un countdown y colgar proactivamente si se agota a
  // mitad de conversación. Esto es UX, no una reserva ni un límite de
  // seguridad: el consumo real sigue decidiéndose en /api/voice/log contra
  // el saldo real de la DB en ese momento (ver tryConsumeVoiceCredit), que
  // puede haber cambiado (p.ej. otra llamada concurrente, un pack comprado
  // a mitad de llamada). El servidor NO puede forzar el corte de una
  // conversación de ElevenLabs ya en curso — el audio va directo
  // navegador↔ElevenLabs, nunca a través de este servidor — así que la
  // autoridad real sigue siendo el saldo en DB, no este número.
  // owner = sin límite: null indica "ilimitado" al cliente.
  let availableSeconds: number | null = null;
  if (!owner) {
    const status = await getVoiceCreditStatus(user.id, user.plan);
    availableSeconds = status.includedRemainingSeconds + status.purchasedRemainingSeconds;
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
    return NextResponse.json({ signedUrl: data.signed_url, dynamicVariables, availableSeconds });
  } catch (err) {
    console.error("Error obteniendo signed URL de ElevenLabs:", err);
    return NextResponse.json({ error: "No se ha podido iniciar la llamada." }, { status: 502 });
  }
}
