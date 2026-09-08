"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Flag } from "lucide-react";
import type { Hole, Round } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { HoleEditor } from "@/components/hole-editor";
import { MoodCheckin } from "@/components/mood-checkin";
import { CoachChat } from "@/components/coach-chat";
import { CallCoach } from "@/components/call-coach";
import { finishRound } from "@/actions/rounds";
import { cn } from "@/lib/utils";
import { formatRelativeToPar, holesPlayed, relativeToPar } from "@/lib/golf";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

type ChatMessage = { id: string; role: "USER" | "ASSISTANT"; content: string };

export function RoundView({
  round,
  initialMessages,
  t,
  moodLabels,
  golfLabels,
  chatT,
  quickPrompts,
}: {
  round: Round & { holes: Hole[] };
  initialMessages: ChatMessage[];
  t: Dictionary["round"];
  moodLabels: Dictionary["mood"];
  golfLabels: Dictionary["golfResult"];
  chatT: Dictionary["chat"];
  quickPrompts: readonly string[];
}) {
  const firstUnplayed = round.holes.find((h) => h.strokes == null);
  const [currentHoleId, setCurrentHoleId] = useState(
    firstUnplayed?.id ?? round.holes[round.holes.length - 1]?.id
  );
  const [chatOpen, setChatOpen] = useState(false);

  const currentHole = useMemo(
    () => round.holes.find((h) => h.id === currentHoleId) ?? round.holes[0],
    [round.holes, currentHoleId]
  );

  const finishRoundBound = finishRound.bind(null, round.id);
  const progress = `${holesPlayed(round.holes)}/${round.totalHoles} · ${formatRelativeToPar(
    relativeToPar(round.holes)
  )}`;

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">{round.course}</h1>
          <p className="text-sm text-muted-foreground">{progress}</p>
        </div>
        {round.status === "IN_PROGRESS" && (
          <form action={finishRoundBound}>
            <Button type="submit" variant="outline" size="sm" className="gap-2">
              <Flag className="size-4" />
              {t.finish}
            </Button>
          </form>
        )}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {round.holes.map((h) => (
          <button
            key={h.id}
            onClick={() => setCurrentHoleId(h.id)}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full border text-sm transition-colors",
              h.id === currentHoleId
                ? "border-primary bg-primary text-primary-foreground"
                : h.strokes != null
                  ? "border-border bg-secondary text-secondary-foreground"
                  : "border-border bg-card text-muted-foreground"
            )}
          >
            {h.number}
          </button>
        ))}
      </div>

      {currentHole && (
        <div className="flex flex-col gap-4">
          <HoleEditor
            key={`editor-${currentHole.id}`}
            roundId={round.id}
            hole={currentHole}
            t={t}
            golfLabels={golfLabels}
          />
          <MoodCheckin
            key={`mood-${currentHole.id}`}
            roundId={round.id}
            holeId={currentHole.id}
            t={t}
            moodLabels={moodLabels}
          />
        </div>
      )}

      <Button
        onClick={() => setChatOpen(true)}
        size="lg"
        className="fixed right-4 bottom-20 z-20 gap-2 rounded-full shadow-lg sm:bottom-6"
      >
        <MessageCircle className="size-5" />
        {t.talkToCoach}
      </Button>

      <Drawer open={chatOpen} onOpenChange={setChatOpen}>
        <DrawerContent className="h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{t.coachTitle}</DrawerTitle>
            <DrawerDescription>
              {currentHole ? `${fmt(t.hole, { n: currentHole.number })} · ${round.course}` : round.course}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
            <CallCoach roundId={round.id} holeId={currentHole?.id} t={chatT} />
            <div className="min-h-0 flex-1">
              <CoachChat
                roundId={round.id}
                holeId={currentHole?.id}
                initialMessages={initialMessages}
                t={chatT}
                quickPrompts={quickPrompts}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
