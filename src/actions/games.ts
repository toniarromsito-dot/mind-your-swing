"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGameSchema, markChallengeWinSchema, saveScoreSchema } from "@/lib/validations";
import { anthropic, COACH_MAX_TOKENS, COACH_MODEL } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/coach/prompt";
import { getCoachContext } from "@/lib/coach/context";
import type { GameMode } from "@prisma/client";

export type ActionState = { error?: string } | undefined;

// Modos con equipos fijos A/B a 4 jugadores.
const TEAM_MODES: GameMode[] = ["TWO_VS_TWO", "BEST_BALL", "SCRAMBLE", "TEAM_DUEL"];

function generateInviteCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function createGame(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const raw = {
    playerCount: formData.get("playerCount"),
    mode: formData.get("mode"),
    courseId: formData.get("courseId") || undefined,
    course: formData.get("course") || undefined,
    date: formData.get("date"),
    goal: formData.get("goal") ?? "",
  };

  const parsed = createGameSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { playerCount, mode, courseId, course, date, goal } = parsed.data;

  let holesData: { number: number; par: number; index: number | null; distance: number | null }[];
  let courseName: string;

  if (courseId) {
    const golfCourse = await prisma.golfCourse.findUniqueOrThrow({
      where: { id: courseId },
      include: { holes: { orderBy: { number: "asc" } } },
    });
    courseName = golfCourse.name;
    holesData = golfCourse.holes.map((h) => ({
      number: h.number,
      par: h.par,
      index: h.index,
      distance: h.distance,
    }));
  } else {
    courseName = course!;
    holesData = Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4, index: null, distance: null }));
  }

  const game = await prisma.game.create({
    data: {
      courseId: courseId ?? null,
      course: courseName,
      mode,
      playerCount,
      date,
      totalHoles: holesData.length,
      goal: goal || null,
      inviteCode: generateInviteCode(),
      holes: { create: holesData },
      players: {
        create: { userId: session.user.id, team: TEAM_MODES.includes(mode) ? "A" : null },
      },
    },
  });

  revalidatePath("/play");
  redirect(`/play/${game.id}`);
}

export async function joinGame(inviteCode: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const game = await prisma.game.findUnique({
    where: { inviteCode },
    include: { players: true },
  });
  if (!game) throw new Error("No se ha encontrado esa partida");

  const alreadyIn = game.players.some((p) => p.userId === session.user.id);
  if (!alreadyIn) {
    if (game.players.length >= game.playerCount) {
      throw new Error("Esta partida ya está completa");
    }
    let team: "A" | "B" | null = null;
    if (TEAM_MODES.includes(game.mode)) {
      const teamACount = game.players.filter((p) => p.team === "A").length;
      team = teamACount < 2 ? "A" : "B";
    }
    await prisma.gamePlayer.create({ data: { gameId: game.id, userId: session.user.id, team } });
  }

  revalidatePath("/play");
  redirect(`/play/${game.id}`);
}

export async function saveScore(gameId: string, input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = saveScoreSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { holeId, strokes, putts } = parsed.data;

  const player = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!player) throw new Error("No perteneces a esta partida");

  const hole = await prisma.hole.findFirst({ where: { id: holeId, gameId } });
  if (!hole) throw new Error("Hoyo no encontrado");

  await prisma.score.upsert({
    where: { holeId_playerId: { holeId, playerId: player.id } },
    update: { strokes, putts },
    create: { holeId, playerId: player.id, strokes, putts },
  });

  revalidatePath(`/play/${gameId}`);
}

export async function markChallengeWin(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = markChallengeWinSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { gameId, challengeKey, playerId, holeId } = parsed.data;

  const me = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!me) throw new Error("No perteneces a esta partida");

  const winner = await prisma.gamePlayer.findFirst({ where: { id: playerId, gameId } });
  if (!winner) throw new Error("Jugador no encontrado en esta partida");

  await prisma.challengeWin.create({ data: { gameId, challengeKey, playerId, holeId } });
  revalidatePath(`/play/${gameId}`);
}

export async function finishGame(gameId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const player = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!player) throw new Error("No perteneces a esta partida");

  const game = await prisma.game.findUniqueOrThrow({ where: { id: gameId } });

  if (game.status === "IN_PROGRESS") {
    await prisma.game.update({ where: { id: gameId }, data: { status: "COMPLETED" } });
    await generateGameInsight(gameId, session.user.id);
  }

  revalidatePath(`/play/${gameId}`);
  revalidatePath(`/play/${gameId}/resumen`);
  revalidatePath("/play");
}

async function generateGameInsight(gameId: string, userId: string) {
  if (!process.env.ANTHROPIC_API_KEY) return;

  try {
    const ctx = await getCoachContext({ userId, gameId });
    const systemPrompt = buildSystemPrompt(ctx);

    const message = await anthropic.messages.create({
      model: COACH_MODEL,
      max_tokens: COACH_MAX_TOKENS,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "La partida acaba de terminar. Escribe un cierre breve (3-5 frases): reconoce el esfuerzo, señala con delicadeza un patrón del estado de ánimo durante la partida si lo hay, y da un consejo concreto para la próxima vez.",
        },
      ],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (text.trim()) {
      await prisma.game.update({ where: { id: gameId }, data: { insight: text } });
    }
  } catch {
    // Degradación silenciosa: el resumen simplemente no tendrá insight de IA.
  }
}
