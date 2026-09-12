import { z } from "zod";

export const moodEnum = z.enum([
  "TRANQUILO",
  "NERVIOSO",
  "FRUSTRADO",
  "CONFIADO",
  "CONCENTRADO",
]);

export const gameModeEnum = z.enum([
  "SOLO",
  "STROKE_PLAY",
  "MATCH_PLAY",
  "DUEL",
  "FRIENDLY_CHALLENGE",
  "EVERYONE_VS_EVERYONE",
  "POINTS",
  "TWO_VS_TWO",
  "BEST_BALL",
  "SCRAMBLE",
  "TEAM_DUEL",
]);

export const createGameSchema = z.object({
  playerCount: z.coerce.number().int().min(1).max(4),
  mode: gameModeEnum,
  courseId: z.string().min(1).optional(),
  course: z.string().trim().min(2, "El nombre del campo es demasiado corto").max(120).optional(),
  date: z.coerce.date(),
  goal: z.string().trim().max(300).optional().or(z.literal("")),
  holeCount: z.coerce.number().int().refine((v) => v === 9 || v === 18, "Elige 9 o 18 hoyos").default(18),
}).refine((v) => v.courseId || v.course, { message: "Elige un campo" });

// Scorecard compartido: cualquier jugador de la partida puede anotar el
// hoyo por todo el grupo en un solo guardado (ver saveHoleScores).
export const saveHoleScoresSchema = z.object({
  gameId: z.string().min(1),
  holeId: z.string().min(1),
  entries: z
    .array(
      z.object({
        playerId: z.string().min(1),
        strokes: z.coerce.number().int().min(1).max(15).optional().nullable(),
        putts: z.coerce.number().int().min(0).max(10).optional().nullable(),
      })
    )
    .min(1),
});

export const setBetSchema = z.object({
  gameId: z.string().min(1),
  bet: z.string().trim().max(200).nullable(),
});

export const markChallengeWinSchema = z.object({
  gameId: z.string().min(1),
  challengeKey: z.string().min(1).max(60),
  playerId: z.string().min(1),
  holeId: z.string().min(1).optional(),
});

export const moodEntrySchema = z.object({
  gameId: z.string().min(1).optional(),
  holeId: z.string().min(1).optional(),
  mood: moodEnum,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const chatMessageSchema = z.object({
  gameId: z.string().min(1).optional(),
  holeId: z.string().min(1).optional(),
  content: z.string().trim().min(1, "Escribe un mensaje").max(2000),
});

export const coachToneEnum = z.enum(["CALM", "MOTIVATOR", "COACH", "FRIEND"]);

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  handicap: z.coerce.number().min(-10).max(54).optional().nullable(),
  coachTone: coachToneEnum.optional(),
  language: z.enum(["es", "en", "de"]).optional(),
});

export const storySchema = z.object({
  title: z.string().trim().min(3, "El título es demasiado corto").max(120),
  content: z.string().trim().min(20, "Cuenta un poco más").max(4000),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type SaveHoleScoresInput = z.infer<typeof saveHoleScoresSchema>;
export type SetBetInput = z.infer<typeof setBetSchema>;
export type MarkChallengeWinInput = z.infer<typeof markChallengeWinSchema>;
export type MoodEntryInput = z.infer<typeof moodEntrySchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type StoryInput = z.infer<typeof storySchema>;
