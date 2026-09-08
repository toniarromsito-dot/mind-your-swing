import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  durationSeconds: z.coerce.number().int().min(0).max(3600),
});

/** Registra la duración de una llamada terminada, para aplicar los minutos incluidos del plan. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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

  if (parsed.data.durationSeconds > 0) {
    await prisma.voiceCallLog.create({
      data: { userId: session.user.id, durationSeconds: parsed.data.durationSeconds },
    });
  }

  return NextResponse.json({ ok: true });
}
