"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRoundSchema } from "@/lib/validations";
import { anthropic, COACH_MAX_TOKENS, COACH_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/coach/prompt";
import { getCoachContext } from "@/lib/coach/context";

export type ActionState = { error?: string } | undefined;

export async function createRound(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const raw = {
    course: formData.get("course"),
    date: formData.get("date"),
    totalHoles: formData.get("totalHoles"),
    goal: formData.get("goal") ?? "",
    initialMood: formData.get("initialMood") || undefined,
    initialNote: formData.get("initialNote") ?? "",
  };

  const parsed = createRoundSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { course, date, totalHoles, goal, initialMood, initialNote } = parsed.data;

  const round = await prisma.round.create({
    data: {
      userId: session.user.id,
      course,
      date,
      totalHoles,
      goal: goal || null,
      holes: {
        create: Array.from({ length: totalHoles }, (_, i) => ({
          number: i + 1,
          par: 4,
        })),
      },
      ...(initialMood
        ? {
            moodEntries: {
              create: {
                userId: session.user.id,
                mood: initialMood,
                note: initialNote || null,
              },
            },
          }
        : {}),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/historial");
  redirect(`/rondas/${round.id}`);
}

export async function finishRound(roundId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const round = await prisma.round.findFirstOrThrow({
    where: { id: roundId, userId: session.user.id },
  });

  if (round.status === "IN_PROGRESS") {
    await prisma.round.update({
      where: { id: roundId },
      data: { status: "COMPLETED" },
    });

    await generateRoundInsight(roundId, session.user.id);
  }

  revalidatePath(`/rondas/${roundId}`);
  revalidatePath(`/rondas/${roundId}/resumen`);
  revalidatePath("/historial");
  redirect(`/rondas/${roundId}/resumen`);
}

async function generateRoundInsight(roundId: string, userId: string) {
  if (!process.env.ANTHROPIC_API_KEY) return;

  try {
    const ctx = await getCoachContext({ userId, roundId });
    const systemPrompt = buildSystemPrompt(ctx);

    const message = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: COACH_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "La ronda acaba de terminar. Escribe un cierre breve (3-5 frases): reconoce el esfuerzo, señala con delicadeza un patrón del estado de ánimo durante la ronda si lo hay, y da un consejo concreto para la próxima ronda.",
        },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (text.trim()) {
      await prisma.round.update({ where: { id: roundId }, data: { insight: text } });
    }
  } catch {
    // Degradación silenciosa: el resumen simplemente no tendrá insight de IA.
  }
}
