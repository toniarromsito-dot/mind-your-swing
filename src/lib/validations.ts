import { z } from "zod";

export const moodEnum = z.enum([
  "TRANQUILO",
  "NERVIOSO",
  "FRUSTRADO",
  "CONFIADO",
  "CONCENTRADO",
]);

export const createRoundSchema = z.object({
  course: z.string().trim().min(2, "El nombre del campo es demasiado corto").max(120),
  date: z.coerce.date(),
  totalHoles: z.coerce.number().int().min(1).max(36),
  goal: z.string().trim().max(300).optional().or(z.literal("")),
  initialMood: moodEnum.optional(),
  initialNote: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateHoleSchema = z.object({
  holeId: z.string().min(1),
  par: z.coerce.number().int().min(3).max(6).optional(),
  distance: z.coerce.number().int().min(0).max(700).optional().nullable(),
  strokes: z.coerce.number().int().min(1).max(15).optional().nullable(),
  putts: z.coerce.number().int().min(0).max(10).optional().nullable(),
});

export const moodEntrySchema = z.object({
  roundId: z.string().min(1),
  holeId: z.string().min(1).optional(),
  mood: moodEnum,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const chatMessageSchema = z.object({
  roundId: z.string().min(1),
  holeId: z.string().min(1).optional(),
  content: z.string().trim().min(1, "Escribe un mensaje").max(2000),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  handicap: z.coerce.number().min(-10).max(54).optional().nullable(),
  coachTone: z.enum(["CERCANO", "FORMAL"]).optional(),
  language: z.enum(["es", "en"]).optional(),
});

export const storySchema = z.object({
  title: z.string().trim().min(3, "El título es demasiado corto").max(120),
  content: z.string().trim().min(20, "Cuenta un poco más").max(4000),
});

export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpdateHoleInput = z.infer<typeof updateHoleSchema>;
export type MoodEntryInput = z.infer<typeof moodEntrySchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type StoryInput = z.infer<typeof storySchema>;
