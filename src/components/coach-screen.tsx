"use client";

import { useState } from "react";
import { CoachHub, type CoachTopic } from "@/components/coach-hub";
import { MindSettingsDrawer } from "@/components/mind-settings-drawer";
import { MindCompanion } from "@/components/mind-companion";
import { MindMark } from "@/components/mind-mark";
import type { CoachTone } from "@prisma/client";
import type { MentalScore, MentalState, MoodPoint } from "@/lib/mood";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ChatMessage = { id: string; role: "USER" | "ASSISTANT"; content: string };

/**
 * Antes de la primera conversación: el hub (foto, saludo, coaching
 * rápido, temas populares, rendimiento mental). En cuanto hay un
 * mensaje real —enviado desde el hub o ya existente al cargar la
 * página—, pasa al chat de siempre. Nunca dos pantallas de verdad
 * distintas: es la misma conversación, solo que el hub es lo que se ve
 * antes de que exista.
 */
export function CoachScreen({
  greeting,
  photo,
  mentalScore,
  mentalState,
  topics,
  quickPrompts,
  initialMessages,
  coachTone,
  moodTrendData,
  hubT,
  homeT,
  chatT,
  mindT,
  moodCheckinT,
  moodLabels,
  noMoodDataLabel,
}: {
  /** Ya resuelto en el servidor (t.mind.greeting(firstName)). */
  greeting: string;
  photo: string;
  mentalScore: MentalScore | null;
  mentalState: MentalState | null;
  topics: CoachTopic[];
  quickPrompts: readonly string[];
  initialMessages: ChatMessage[];
  coachTone: CoachTone;
  moodTrendData: MoodPoint[];
  /** Sin `greeting`: es una función y no se puede pasar a un Client Component. */
  hubT: Omit<Dictionary["mind"], "greeting">;
  homeT: Dictionary["home"];
  chatT: Dictionary["chat"];
  mindT: Omit<Dictionary["mind"], "greeting">;
  moodCheckinT: Dictionary["moodCheckin"];
  moodLabels: Dictionary["mood"];
  noMoodDataLabel: string;
}) {
  const [started, setStarted] = useState(initialMessages.length > 0);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  if (!started) {
    return (
      <CoachHub
        greeting={greeting}
        photo={photo}
        mentalScore={mentalScore}
        mentalState={mentalState}
        topics={topics}
        quickPrompts={quickPrompts}
        t={hubT}
        homeT={homeT}
        onStart={(message) => {
          setPendingMessage(message);
          setStarted(true);
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-11.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-lg flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MindMark size="lg" />
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{mindT.title}</h1>
            <p className="text-sm text-muted-foreground">{mindT.subtitle}</p>
          </div>
        </div>
        <MindSettingsDrawer
          coachTone={coachTone}
          moodTrendData={moodTrendData}
          noMoodDataLabel={noMoodDataLabel}
          t={mindT}
          moodCheckinT={moodCheckinT}
          moodLabels={moodLabels}
        />
      </div>

      <MindCompanion
        initialMessages={initialMessages}
        t={chatT}
        quickPrompts={quickPrompts}
        autoSendMessage={pendingMessage}
      />
    </div>
  );
}
