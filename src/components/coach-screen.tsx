"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, MessageCircle, Video, Phone } from "lucide-react";
import { CoachHub, type CoachTopic } from "@/components/coach-hub";
import { MindSettingsDrawer } from "@/components/mind-settings-drawer";
import { MindCompanion } from "@/components/mind-companion";
import type { CoachTone } from "@prisma/client";
import type { MentalScore, MentalState, MoodPoint } from "@/lib/mood";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ChatMessage = { id: string; role: "USER" | "ASSISTANT"; content: string };

/**
 * Coach es inmersivo como Home y el menú de Aprende (ver isImmersivePage
 * en app-shell.tsx): foto real a pantalla completa, logo grande y flecha
 * de atrás, con 3 accesos rápidos siempre visibles (Chat IA / Análisis de
 * swing / Llamar ahora) encima de la conversación. Antes de la primera
 * conversación se ve el hub (saludo, coaching rápido, temas populares,
 * rendimiento mental); en cuanto hay un mensaje real pasa al chat de
 * siempre — nunca dos pantallas distintas, es la misma conversación.
 */
export function CoachScreen({
  greeting,
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

  function startChat(message?: string) {
    if (message) setPendingMessage(message);
    setStarted(true);
  }

  return (
    <div className="relative h-svh overflow-hidden">
      <Image
        src="/images/coach-hero-v2.jpg"
        alt=""
        fill
        sizes="100vw"
        className="object-cover"
        priority
      />
      <div className="relative flex h-full flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex shrink-0 items-center justify-between">
          <Link
            href="/dashboard"
            aria-label={homeT.mentalGameTitle}
            className="flex size-9 items-center justify-center rounded-full bg-black/10 text-foreground backdrop-blur-sm"
          >
            <ChevronLeft className="size-5" />
          </Link>
          {started && (
            <MindSettingsDrawer
              coachTone={coachTone}
              moodTrendData={moodTrendData}
              noMoodDataLabel={noMoodDataLabel}
              t={mindT}
              moodCheckinT={moodCheckinT}
              moodLabels={moodLabels}
            />
          )}
        </div>

        <div className="mt-2 flex shrink-0 flex-col leading-none">
          <span className="font-sans text-3xl font-bold tracking-tight text-primary">
            MYS
          </span>
          <span className="mt-0.5 text-xs text-foreground/70">
            Mind Your Swing
          </span>
        </div>

        <div className="mt-3 shrink-0">
          <h1 className="font-heading text-3xl font-bold text-foreground">
            {mindT.heroHeadline}
          </h1>
          <p className="mt-1 text-sm text-foreground/80">
            {mindT.heroTagline}
          </p>
        </div>

        <div className="mt-3 grid shrink-0 grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => startChat()}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/90 px-2 py-2.5 text-center shadow-sm backdrop-blur-sm"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <MessageCircle className="size-3.5" strokeWidth={1.5} />
            </span>
            <span className="text-[11px] leading-tight font-semibold">
              {mindT.chatModeTitle}
            </span>
            <span className="text-[9.5px] leading-tight text-muted-foreground">
              {mindT.chatModeDescription}
            </span>
          </button>
          <Link
            href="/aprende/videos"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-card/90 px-2 py-2.5 text-center shadow-sm backdrop-blur-sm"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Video className="size-3.5" strokeWidth={1.5} />
            </span>
            <span className="text-[11px] leading-tight font-semibold">
              {mindT.swingModeTitle}
            </span>
            <span className="text-[9.5px] leading-tight text-muted-foreground">
              {mindT.swingModeDescription}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => startChat()}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-primary px-2 py-2.5 text-center text-primary-foreground shadow-sm"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-white/20">
              <Phone className="size-3.5" strokeWidth={1.5} />
            </span>
            <span className="text-[11px] leading-tight font-semibold">
              {mindT.callModeTitle}
            </span>
            <span className="text-primary-foreground/80 text-[9.5px] leading-tight">
              {mindT.callModeDescription}
            </span>
          </button>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          {started ? (
            <MindCompanion
              initialMessages={initialMessages}
              t={chatT}
              quickPrompts={quickPrompts}
              autoSendMessage={pendingMessage}
            />
          ) : (
            <CoachHub
              greeting={greeting}
              mentalScore={mentalScore}
              mentalState={mentalState}
              topics={topics}
              quickPrompts={quickPrompts}
              t={hubT}
              homeT={homeT}
              onStart={startChat}
            />
          )}
        </div>
      </div>
    </div>
  );
}
