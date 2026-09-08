import type { CoachTone, Mood } from "@prisma/client";

export type CoachPhase = "pre_ronda" | "durante_ronda" | "post_ronda";

export type CoachMoodSnapshot = {
  mood: Mood;
  note: string | null;
  holeNumber: number | null;
};

export type CoachContext = {
  phase: CoachPhase;
  playerName: string;
  tone: CoachTone;
  language: string;
  round: {
    course: string;
    totalHoles: number;
    goal: string | null;
  };
  currentHole?: {
    number: number;
    par: number;
    distance: number | null;
    strokes: number | null;
    putts: number | null;
  } | null;
  roundProgress?: {
    holesPlayed: number;
    totalHoles: number;
    relativeToPar: string;
  } | null;
  recentMood: CoachMoodSnapshot[];
  historySummary: string | null;
};
