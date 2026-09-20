"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Crown, Loader2, MapPin, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MoodCheckin } from "@/components/mood-checkin";
import { DetailsDrawer } from "@/components/details-drawer";
import { InviteDrawer } from "@/components/invite-drawer";
import { setBet, startGame } from "@/actions/games";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/i18n/format";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const BET_PRESETS = [
  { key: "coffee", emoji: "☕" },
  { key: "beer", emoji: "🍺" },
  { key: "meal", emoji: "🍽️" },
] as const;

type LobbyPlayer = {
  id: string;
  name: string;
  image: string | null;
  handicap: number | null;
  isCreator: boolean;
};

function PlayerAvatar({ name, image, size = 40 }: { name: string; image: string | null; size?: number }) {
  if (image) {
    return (
      <Image src={image} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name[0] ?? "?"}
    </div>
  );
}

export function GameLobby({
  gameId,
  course,
  layoutName,
  teeName,
  totalHoles,
  totalPar,
  date,
  inviteCode,
  isSolo,
  playerCount,
  players,
  modeLabel,
  bet,
  t,
  playT,
  holesLabel,
  dateLocale,
  moodLabels,
  moodCheckinT,
}: {
  gameId: string;
  course: string;
  layoutName: string | null;
  teeName: string | null;
  totalHoles: number;
  totalPar: number;
  date: string;
  inviteCode: string;
  isSolo: boolean;
  playerCount: number;
  players: LobbyPlayer[];
  modeLabel: string;
  bet: string | null;
  t: Dictionary["lobby"];
  playT: Dictionary["play"];
  /** "18 hoyos", ya resuelto server-side (fmt(t.summary.holesTotal, ...)) — t.summary trae funciones (holeLabel, chartHole...) que no se pueden pasar de un Server Component a este Client Component. */
  holesLabel: string;
  dateLocale: string;
  moodLabels: Dictionary["mood"];
  moodCheckinT: Dictionary["moodCheckin"];
}) {
  const router = useRouter();
  const [betText, setBetText] = useState(bet ?? "");
  const [showCustomBet, setShowCustomBet] = useState(Boolean(bet) && !BET_PRESETS.some((p) => t.betPresets[p.key] === bet));
  const [isStarting, startStarting] = useTransition();
  const [isSavingBet, startSavingBet] = useTransition();

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
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background">
      <div className="relative flex h-[20vh] min-h-[150px] shrink-0 flex-col justify-end overflow-hidden px-4 pt-[env(safe-area-inset-top)] pb-4 sm:px-6">
        <Image src="/images/play-hero.jpg" alt="" fill sizes="100vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/15 to-black/55" />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.25em] text-white/80 uppercase">{playT.heroEyebrow}</p>
          <h1 className="mt-0.5 font-heading text-2xl font-bold text-white">{t.heroHeadline}</h1>
          <p className="text-xs text-white/85">{t.subtitle}</p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col gap-2.5 rounded-t-3xl bg-background px-4 pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl">
          <Image src={DASHBOARD_PHOTOS.play} alt="" fill sizes="44px" className="object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-semibold">{course}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {totalHoles} · {t.par} {totalPar}
            {" · "}
            {new Date(date).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })}
            {" · "}
            {new Date(date).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      {!isSolo && (
        <Card className="shrink-0 py-0">
          <CardContent className="flex flex-col gap-2 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" />
              {t.playersLabel} · {players.length}/{playerCount}
            </p>
            <div className="flex flex-col gap-1.5">
              {players.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <PlayerAvatar name={p.name} image={p.image} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {p.name}
                      {p.isCreator && <Crown className="size-3.5 text-primary" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.handicap != null && fmt(t.handicapLabel, { n: p.handicap })}
                      {p.handicap != null && p.isCreator && " · "}
                      {p.isCreator && `(${t.youLabel})`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {players.length < playerCount && (
              <InviteDrawer
                inviteCode={inviteCode}
                course={course}
                layoutName={layoutName}
                teeName={teeName}
                holesLabel={holesLabel}
                t={t}
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
        <span className="flex size-7 shrink-0 items-center justify-center text-primary">
          <FileText className="size-4" strokeWidth={1.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-muted-foreground">{t.formatLabel}</p>
          <p className="text-sm font-semibold">
            {totalHoles} · {modeLabel}
          </p>
        </div>
      </div>

      {/* Apuesta y check-in de humor: secundario, no apilado en la
          pantalla principal — mismo patrón que "Ver detalles" en el
          resumen final (DetailsDrawer), para que el lobby quepa siempre
          en una pantalla sin scroll. */}
      <DetailsDrawer label={t.moreOptionsLabel}>
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
      </DetailsDrawer>

      <div className="min-h-0 flex-1" />

      <Button size="lg" className="h-12 shrink-0 rounded-2xl text-base" disabled={isStarting} onClick={begin}>
        {isStarting ? <Loader2 className="size-5 animate-spin" /> : t.start}
      </Button>
      </div>
    </div>
  );
}
