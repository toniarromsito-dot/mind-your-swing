import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { tryConsumeVoiceCredit } from "@/lib/voice/credits";

export const runtime = "nodejs";

// Fase 11E: rate limit de SEGURIDAD, separado del saldo de créditos —
// protege el endpoint de ráfagas/abuso (cuántas veces se puede llamar),
// nunca cuántos minutos quedan (eso lo decide tryConsumeVoiceCredit). Sin
// número fijado por la especificación de producto; se elige un valor
// generoso para no bloquear reintentos legítimos ni varias llamadas reales
// en una misma sesión, documentado igual que el de Swing AI para poder
// ajustarse después sin tocar nada más.
const VOICE_LOG_RATE_LIMIT = { windowMs: 10 * 60_000, maxRequests: 20 };

const bodySchema = z
  .object({
    durationSeconds: z.coerce.number().int().min(0).max(3600),
    conversationId: z.string().trim().min(1).max(200).optional(),
  })
  .refine((data) => data.durationSeconds === 0 || Boolean(data.conversationId), {
    message: "conversationId es obligatorio para registrar una llamada real",
    path: ["conversationId"],
  });

/**
 * Registra la duración de una llamada terminada y consume el saldo de
 * Voice que corresponda (incluidos primero, comprados después — Fase
 * 11E). userId SIEMPRE sale de la sesión, nunca de un campo del body.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rl = checkRateLimit(`voice-log:${session.user.id}`, VOICE_LOG_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Estás registrando llamadas demasiado rápido. Espera unos minutos." },
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

  // Duración 0 = no-op (llamada nunca llegó a conectar de verdad) — mismo
  // comportamiento que antes de esta fase, sin tocar el ledger.
  if (parsed.data.durationSeconds === 0) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  const result = await tryConsumeVoiceCredit(
    session.user.id,
    user.plan,
    parsed.data.durationSeconds,
    parsed.data.conversationId!
  );

  return NextResponse.json({ ok: true, idempotent: result.idempotent });
}
