"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Flag, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { HoleScoreEditor } from "@/components/hole-score-editor";
import { MoodCheckin } from "@/components/mood-checkin";
import { CoachChat } from "@/components/coach-chat";
import { CallCoach } from "@/components/call-coach";
import { StandingsPanel } from "@/components/standings-panel";
import { ChallengeBar } from "@/components/challenge-bar";
import { finishGame } from "@/actions/games";
import { cn } from "@/lib/utils";
import { toStandingsInput } from "@/lib/games/adapt";
import { GAME_MODE_META } from "@/lib/games/modes";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

type ChatMessage = { id: string; role: "USER" | "ASSISTANT"; content: string };

type GameForView = {
  id: string;
  course: string;
  mode: import("@prisma/client").GameMode;
  status: "IN_PROGRESS" | "COMPLETED";
  totalHoles: number;
  inviteCode: string;
  holes: { id: string; number: number; par: number; distance: number | null }[];
  players: {
    id: string;
    team: "A" | "B" | null;
    user: { id: string; name: string | null; image: string | null };
    scores: { holeId: string; strokes: number | null; putts: number | null }[];
  }[];
};

export function GameView({
  game,
  myUserId,
  initialMessages,
  t,
  moodLabels,
  golfLabels,
  standingsT,
  chatT,
  moodCheckinT,
  quickPrompts,
}: {
  game: GameForView;
  myUserId: string;
  initialMessages: ChatMessage[];
  t: Dictionary["playGame"];
  moodLabels: Dictionary["mood"];
  golfLabels: Dictionary["golfResult"];
  standingsT: Dictionary["standings"];
  chatT: Dictionary["chat"];
  moodCheckinT: Dictionary["moodCheckin"];
  quickPrompts: readonly string[];
}) {
  const myPlayer = game.players.find((p) => p.user.id === myUserId)!;
  const myScoreByHole = new Map(myPlayer.scores.map((s) => [s.holeId, s]));

  const firstUnplayed = game.holes.find((h) => myScoreByHole.get(h.id)?.strokes == null);
  const [currentHoleId, setCurrentHoleId] = useState(
    firstUnplayed?.id ?? game.holes[game.holes.length - 1]?.id
  );
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentHole = useMemo(
    () => game.holes.find((h) => h.id === currentHoleId) ?? game.holes[0],
    [game.holes, currentHoleId]
  );

  const { players, scores } = useMemo(() => toStandingsInput(game), [game]);
  const modeUsesChallenges = GAME_MODE_META[game.mode].usesChallenges;

  const router = useRouter();
  const [isFinishing, startFinishing] = useTransition();
  const playedCount = myPlayer.scores.filter((s) => s.strokes != null).length;

  function copyInviteLink() {
    const url = `${window.location.origin}/play/join/${game.inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function finish() {
    startFinishing(async () => {
      await finishGame(game.id);
      router.push(`/play/${game.id}/resumen`);
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl">{game.course}</h1>
          <p className="text-sm text-muted-foreground">
            {playedCount}/{game.totalHoles} {t.holesShort}
          </p>
        </div>
        <div className="flex gap-2">
          {game.players.length < 4 && (
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copyInviteLink}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {t.invite}
            </Button>
          )}
          {game.status === "IN_PROGRESS" && (
            <Button type="button" variant="outline" size="sm" className="gap-2" disabled={isFinishing} onClick={finish}>
              {isFinishing ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
              {t.finish}
            </Button>
          )}
        </div>
      </div>

      <StandingsPanel
        mode={game.mode}
        players={players}
        scores={scores}
        totalHoles={game.totalHoles}
        t={standingsT}
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {game.holes.map((h) => {
          const myScore = myScoreByHole.get(h.id);
          return (
            <button
              key={h.id}
              onClick={() => setCurrentHoleId(h.id)}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full border text-sm transition-colors",
                h.id === currentHoleId
                  ? "border-primary bg-primary text-primary-foreground"
                  : myScore?.strokes != null
                    ? "border-border bg-secondary text-secondary-foreground"
                    : "border-border bg-card text-muted-foreground"
              )}
            >
              {h.number}
            </button>
          );
        })}
      </div>

      {currentHole && (
        <div className="flex flex-col gap-4">
          <HoleScoreEditor
            key={`editor-${currentHole.id}`}
            gameId={game.id}
            hole={currentHole}
            myStrokes={myScoreByHole.get(currentHole.id)?.strokes ?? null}
            myPutts={myScoreByHole.get(currentHole.id)?.putts ?? null}
            t={t}
            golfLabels={golfLabels}
          />
          {modeUsesChallenges && (
            <ChallengeBar gameId={game.id} holeId={currentHole.id} players={players} t={t} />
          )}
          <MoodCheckin
            key={`mood-${currentHole.id}`}
            gameId={game.id}
            holeId={currentHole.id}
            t={moodCheckinT}
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
              {currentHole ? `${fmt(t.hole, { n: currentHole.number })} · ${game.course}` : game.course}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
            <CallCoach gameId={game.id} holeId={currentHole?.id} t={chatT} />
            <div className="min-h-0 flex-1">
              <CoachChat
                gameId={game.id}
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
