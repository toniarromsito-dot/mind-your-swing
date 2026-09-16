"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addShotSchema,
  createGameSchema,
  markChallengeWinSchema,
  removeShotSchema,
  saveHoleScoresSchema,
  setBetSchema,
} from "@/lib/validations";
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
    holeCount: formData.get("holeCount") || 18,
    playerIds: formData.getAll("playerIds").filter((v): v is string => typeof v === "string" && v.length > 0),
  };

  const parsed = createGameSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { playerCount, mode, courseId, course, date, goal, holeCount, playerIds } = parsed.data;

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

  // "9 hoyos" juega solo la primera vuelta (hoyos 1-9) — no hace falta que
  // el usuario tenga tiempo para los 18 (ver brief).
  if (holeCount === 9) {
    holesData = holesData.slice(0, 9);
  }

  // Jugadores reales elegidos por nombre al crear (además del creador),
  // deduplicados y recortados a playerCount - 1: se añaden directamente
  // como GamePlayer, igual que si ya hubieran usado el código de invitación.
  const extraPlayerIds = [...new Set(playerIds ?? [])]
    .filter((id) => id !== session.user.id)
    .slice(0, Math.max(0, playerCount - 1));
  const usesTeams = TEAM_MODES.includes(mode);
  const allPlayerIds = [session.user.id, ...extraPlayerIds];

  // started queda en su default (false): la partida arranca en el lobby,
  // no directamente en el scorecard — ver /play/[id]/page.tsx.
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
        create: allPlayerIds.map((userId, i) => ({
          userId,
          // Mismo reparto que joinGame: los 2 primeros al equipo A, el resto al B.
          team: usesTeams ? (i < 2 ? "A" : "B") : null,
        })),
      },
    },
  });

  revalidatePath("/play");
  redirect(`/play/${game.id}`);
}

/** Buscar jugadores reales por nombre al crear una partida (paso "Jugadores"), para añadirlos directamente sin código de invitación. */
export async function searchPlayersToInvite(query: string) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.user.findMany({
    where: { id: { not: session.user.id }, name: { contains: trimmed, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true, image: true, handicap: true },
  });
}

/** Del formulario de "Unirte a una partida" con código escrito a mano: solo redirige a la página que ya resuelve el código (/play/join/[code]), sin unir aquí. */
export async function goToJoinByCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "missingCode" };
  redirect(`/play/join/${encodeURIComponent(code)}`);
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

/** Pasa la partida del lobby al Focus Mode. Cualquier jugador puede darle a "Empezar". */
export async function startGame(gameId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const player = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!player) throw new Error("No perteneces a esta partida");

  await prisma.game.update({ where: { id: gameId }, data: { started: true } });
  revalidatePath(`/play/${gameId}`);
}

/** Apuesta amistosa opcional, editable solo mientras la partida está en el lobby. */
export async function setBet(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = setBetSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { gameId, bet } = parsed.data;

  const player = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!player) throw new Error("No perteneces a esta partida");

  await prisma.game.update({ where: { id: gameId }, data: { bet: bet || null } });
  revalidatePath(`/play/${gameId}`);
}

/**
 * Scorecard compartido: guarda los golpes de TODOS los jugadores en un
 * hoyo de una vez. Cualquier jugador de la partida puede anotar por todo
 * el grupo — no hace falta que cada uno saque su móvil (ver brief).
 */
export async function saveHoleScores(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = saveHoleScoresSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { gameId, holeId, entries } = parsed.data;

  const me = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!me) throw new Error("No perteneces a esta partida");

  const hole = await prisma.hole.findFirst({ where: { id: holeId, gameId } });
  if (!hole) throw new Error("Hoyo no encontrado");

  const validPlayerIds = new Set(
    (await prisma.gamePlayer.findMany({ where: { gameId }, select: { id: true } })).map((p) => p.id)
  );

  await prisma.$transaction(
    entries
      .filter((e) => validPlayerIds.has(e.playerId))
      .map((e) =>
        prisma.score.upsert({
          where: { holeId_playerId: { holeId, playerId: e.playerId } },
          update: { strokes: e.strokes, putts: e.putts, club: e.club },
          create: { holeId, playerId: e.playerId, strokes: e.strokes, putts: e.putts, club: e.club },
        })
      )
  );

  revalidatePath(`/play/${gameId}`);
}

/**
 * Registra un golpe individual (Drive 248m, Hierro 7 132m...) — capa de
 * detalle opcional sobre saveHoleScores. Score.strokes se mantiene en
 * sync como el recuento de Shot de ese hoyo/jugador, así que standings,
 * resumen y el motor de hándicap siguen leyendo el mismo campo de
 * siempre sin ningún cambio.
 */
export async function addShot(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = addShotSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { gameId, holeId, playerId, club, distanceMeters } = parsed.data;

  const me = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!me) throw new Error("No perteneces a esta partida");

  const hole = await prisma.hole.findFirst({ where: { id: holeId, gameId } });
  if (!hole) throw new Error("Hoyo no encontrado");

  const player = await prisma.gamePlayer.findFirst({ where: { id: playerId, gameId } });
  if (!player) throw new Error("Jugador no encontrado en esta partida");

  const score = await prisma.score.upsert({
    where: { holeId_playerId: { holeId, playerId } },
    update: {},
    create: { holeId, playerId },
    include: { shots: true },
  });

  await prisma.shot.create({
    data: { scoreId: score.id, club, distanceMeters, sequence: score.shots.length + 1 },
  });
  await prisma.score.update({ where: { id: score.id }, data: { strokes: score.shots.length + 1 } });

  revalidatePath(`/play/${gameId}`);
}

export async function removeShot(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autenticado");

  const parsed = removeShotSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const { gameId, shotId } = parsed.data;

  const me = await prisma.gamePlayer.findFirst({ where: { gameId, userId: session.user.id } });
  if (!me) throw new Error("No perteneces a esta partida");

  const shot = await prisma.shot.findFirst({
    where: { id: shotId },
    include: { score: { include: { hole: true, shots: true } } },
  });
  if (!shot || shot.score.hole.gameId !== gameId) throw new Error("Golpe no encontrado");

  await prisma.shot.delete({ where: { id: shotId } });
  const remaining = shot.score.shots.length - 1;
  await prisma.score.update({ where: { id: shot.score.id }, data: { strokes: remaining > 0 ? remaining : null } });

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
    // En paralelo, no en serie — dos llamadas a Claude una detrás de otra
    // dejaba al jugador mirando el spinner de "Guardando…" el doble de
    // tiempo de lo necesario.
    await Promise.all([generateGameInsight(gameId, session.user.id), updateMindMemory(session.user.id, gameId)]);
  }

  revalidatePath(`/play/${gameId}`);
  revalidatePath(`/play/${gameId}/resumen`);
  revalidatePath("/play");
}

/** Crea una nueva partida (en su propio lobby) con el mismo campo/modo/jugadores — botón "¿Revancha?". */
export async function createRematch(gameId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const source = await prisma.game.findUniqueOrThrow({
    where: { id: gameId },
    include: { players: true, golfCourse: { include: { holes: { orderBy: { number: "asc" } } } } },
  });
  const amPlayer = source.players.some((p) => p.userId === session.user.id);
  if (!amPlayer) throw new Error("No perteneces a esta partida");

  const holesData = source.golfCourse
    ? source.golfCourse.holes.map((h) => ({ number: h.number, par: h.par, index: h.index, distance: h.distance }))
    : Array.from({ length: source.totalHoles }, (_, i) => ({ number: i + 1, par: 4, index: null, distance: null }));

  const rematch = await prisma.game.create({
    data: {
      courseId: source.courseId,
      course: source.course,
      mode: source.mode,
      playerCount: source.playerCount,
      date: new Date(),
      totalHoles: holesData.length,
      inviteCode: generateInviteCode(),
      holes: { create: holesData },
      players: { create: source.players.map((p) => ({ userId: p.userId, team: p.team })) },
    },
  });

  revalidatePath("/play");
  redirect(`/play/${rematch.id}`);
}

async function generateGameInsight(gameId: string, userId: string) {
  if (!process.env.ANTHROPIC_API_KEY) return;

  try {
    const ctx = await getCoachContext({ userId, gameId });
    const systemPrompt = buildSystemPrompt(ctx);

    const message = await anthropic.messages.create(
      {
        model: COACH_MODEL,
        max_tokens: COACH_MAX_TOKENS,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "La partida acaba de terminar. Escribe un análisis breve pero concreto (4-6 frases): reconoce el esfuerzo, y si el desglose de la vuelta incluye un tramo flojo, señálalo específicamente por número de hoyo (no en general). Cierra con un objetivo concreto para la próxima vez.",
          },
        ],
      },
      // Límite defensivo: esto corre en el camino crítico de "terminar
      // partida" — mejor un resumen sin insight que un jugador mirando el
      // spinner indefinidamente si Anthropic tarda.
      { timeout: 20_000 }
    );

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

/**
 * Mantiene un párrafo corto y evolutivo de memoria por jugador (no un
 * historial completo) — es lo que hace que Mind se sienta continuo entre
 * partidas en vez de empezar de cero cada vez. Solo se usa (se lee) para
 * jugadores Pro, ver coach/context.ts, pero se actualiza siempre para que
 * la memoria ya esté lista si el jugador pasa a Pro más adelante.
 */
async function updateMindMemory(userId: string, gameId: string) {
  if (!process.env.ANTHROPIC_API_KEY) return;

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ctx = await getCoachContext({ userId, gameId });

    const message = await anthropic.messages.create(
      {
        model: COACH_MODEL,
        max_tokens: 300,
        system:
          "Mantienes una memoria corta (3-6 frases) sobre un jugador de golf para que su compañero de IA no empiece de cero cada vez. Actualiza la memoria anterior con lo más relevante de esta partida: patrones mentales, en qué se ha trabajado, objetivos pendientes. No repitas resultados numéricos de partidas concretas, quédate con el patrón. Responde solo con el párrafo actualizado, nada más.",
        messages: [
          {
            role: "user",
            content: [
              `Memoria anterior: ${user.mindMemory ?? "(todavía no hay memoria de este jugador)"}`,
              `Contexto de la partida que acaba de terminar: ${buildSystemPrompt(ctx)}`,
            ].join("\n\n"),
          },
        ],
      },
      { timeout: 20_000 }
    );

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (text) {
      await prisma.user.update({ where: { id: userId }, data: { mindMemory: text } });
    }
  } catch {
    // Degradación silenciosa: sin memoria actualizada, Mind sigue funcionando igual de bien puntualmente.
  }
}
