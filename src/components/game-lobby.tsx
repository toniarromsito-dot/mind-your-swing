"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MoodCheckin } from "@/components/mood-checkin";
import { setBet, startGame } from "@/actions/games";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const BET_PRESETS = [
  { key: "coffee", emoji: "☕" },
  { key: "beer", emoji: "🍺" },
  { key: "meal", emoji: "🍽️" },
] as const;

type LobbyPlayer = { id: string; name: string; image: string | null };

export function GameLobby({
  gameId,
  course,
  inviteCode,
  isSolo,
  playerCount,
  players,
  bet,
  t,
  moodLabels,
  moodCheckinT,
}: {
  gameId: string;
  course: string;
  inviteCode: string;
  isSolo: boolean;
  playerCount: number;
  players: LobbyPlayer[];
  bet: string | null;
  t: Dictionary["lobby"];
  moodLabels: Dictionary["mood"];
  moodCheckinT: Dictionary["moodCheckin"];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [betText, setBetText] = useState(bet ?? "");
  const [showCustomBet, setShowCustomBet] = useState(Boolean(bet) && !BET_PRESETS.some((p) => t.betPresets[p.key] === bet));
  const [isStarting, startStarting] = useTransition();
  const [isSavingBet, startSavingBet] = useTransition();

  function copyInviteLink() {
    const url = `${window.location.origin}/play/join/${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function saveBet(next: string | null) {
    startSavingBet(async () => {
      try {
        await setBet({ gameId, bet: next });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.betSaveError);
      }
    });
  }

  function begin() {
    startStarting(async () => {
      await startGame(gameId);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{course}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {!isSolo && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Users className="size-4" />
              {players.length}/{playerCount} {t.playersJoined}
            </p>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <span key={p.id} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
                  {p.name}
                </span>
              ))}
            </div>
            {players.length < playerCount && (
              <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={copyInviteLink}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {t.invite}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isSolo && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t.betPrompt}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCustomBet(false);
                setBetText("");
                saveBet(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                !betText ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary/60"
              )}
            >
              {t.noBet}
            </button>
            {BET_PRESETS.map((preset) => {
              const label = `${preset.emoji} ${t.betPresets[preset.key]}`;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setShowCustomBet(false);
                    setBetText(t.betPresets[preset.key]);
                    saveBet(t.betPresets[preset.key]);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    betText === t.betPresets[preset.key]
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary/60"
                  )}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCustomBet(true)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                showCustomBet ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary/60"
              )}
            >
              💰 {t.customBet}
            </button>
          </div>
          {showCustomBet && (
            <div className="flex gap-2">
              <Input
                value={betText}
                onChange={(e) => setBetText(e.target.value)}
                placeholder={t.customBetPlaceholder}
                maxLength={200}
              />
              <Button type="button" variant="outline" disabled={isSavingBet} onClick={() => saveBet(betText || null)}>
                {t.save}
              </Button>
            </div>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">{t.moodPrompt}</p>
        <MoodCheckin gameId={gameId} t={moodCheckinT} moodLabels={moodLabels} />
      </div>

      <Button size="lg" className="h-14 rounded-2xl text-base" disabled={isStarting} onClick={begin}>
        {isStarting ? <Loader2 className="size-5 animate-spin" /> : t.start}
      </Button>
    </div>
  );
}
