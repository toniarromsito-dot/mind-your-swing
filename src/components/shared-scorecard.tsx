"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addShot, removeShot } from "@/actions/games";
import { strokesReceivedOnHole } from "@/lib/games/handicap";
import { holeResultLabel } from "@/lib/golf";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type Shot = { id: string; club: string; distanceMeters: number | null; sequence: number };
export type ScorecardPlayer = { id: string; name: string; handicap: number | null; strokes: number | null; shots: Shot[] };

const CLUBS = ["driver", "wood", "iron", "wedge", "putter", "other"] as const;
type Club = (typeof CLUBS)[number];

/**
 * PLAY se aparta: el jugador registra cada golpe en cuanto lo da (Drive,
 * Hierro 7, Chip, Putt...) en vez de teclear un total al final — más
 * rápido y usable con una mano, y Score.strokes se mantiene en sync como
 * el recuento de golpes real (ver addShot/removeShot en actions/games.ts).
 * Nada de feed social, Insights ni contenido de Aprende aquí, y el Coach
 * solo aparece si el jugador lo pide (MindQuickCard en game-view.tsx).
 */
export function SharedScorecard({
  gameId,
  hole,
  totalHoles,
  players,
  onSaved,
  t,
  golfResult,
}: {
  gameId: string;
  hole: { id: string; number: number; par: number; distance: number | null; index: number | null };
  totalHoles: number;
  players: ScorecardPlayer[];
  onSaved: () => void;
  t: Dictionary["playGame"];
  golfResult: Dictionary["golfResult"];
}) {
  const [playerIndex, setPlayerIndex] = useState(() => {
    const firstUnset = players.findIndex((p) => p.shots.length === 0);
    return firstUnset === -1 ? 0 : firstUnset;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const player = players[playerIndex];
  const strokesReceived =
    hole.index != null && player.handicap != null ? strokesReceivedOnHole(player.handicap, hole.index) : 0;

  function pickClub(club: Club) {
    if (isPending) return;
    startTransition(async () => {
      try {
        await addShot({ gameId, holeId: hole.id, playerId: player.id, club });
        setPickerOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.saveError);
      }
    });
  }

  function deleteShot(shotId: string) {
    if (isPending) return;
    startTransition(async () => {
      try {
        await removeShot({ gameId, shotId });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.saveError);
      }
    });
  }

  function goNext() {
    if (playerIndex + 1 < players.length) {
      setPlayerIndex((i) => i + 1);
    } else {
      onSaved();
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
      <div className="text-center">
        <h1 className="font-heading text-4xl font-bold tracking-tight">{fmt(t.hole, { n: hole.number, total: totalHoles })}</h1>
        {players.length > 1 && <p className="mt-1 text-sm font-medium text-muted-foreground">{player.name}</p>}
      </div>

      <div className="flex items-start justify-center gap-8">
        <div className="text-center">
          <p className="font-heading text-2xl font-semibold">{hole.par}</p>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{t.par}</p>
        </div>
        {hole.distance != null && (
          <div className="text-center">
            <p className="font-heading text-2xl font-semibold">{hole.distance}</p>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">m</p>
          </div>
        )}
        {hole.index != null && (
          <div className="text-center">
            <p className="font-heading text-2xl font-semibold">{hole.index}</p>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">SI</p>
          </div>
        )}
      </div>

      {strokesReceived > 0 && (
        <span className="mx-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {fmt(t.hcpBadge, { n: strokesReceived })}
        </span>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">{t.shotsTitle}</p>
          {player.shots.length > 0 && (
            <p className="text-xs font-medium text-primary">
              {holeResultLabel(hole.par, player.shots.length, golfResult)}
            </p>
          )}
        </div>
        {player.shots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {t.noShotsYet}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {player.shots.map((shot) => (
              <div key={shot.id} className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
                <span className="font-medium">{t.clubs[shot.club as Club] ?? shot.club}</span>
                <span className="flex items-center gap-3 text-sm text-muted-foreground">
                  {shot.distanceMeters != null && fmt(t.distanceMeters, { n: shot.distanceMeters })}
                  <button
                    type="button"
                    onClick={() => deleteShot(shot.id)}
                    disabled={isPending}
                    aria-label="Remove shot"
                    className="text-muted-foreground/60 hover:text-destructive disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="rounded-2xl border border-primary/40 bg-primary/5 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        + {t.addShotCta}
      </button>

      <div className="flex-1" />

      {player.shots.length > 0 && (
        <button
          type="button"
          onClick={goNext}
          className="w-full rounded-full bg-primary py-4 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.01]"
        >
          {t.nextHoleCta}
        </button>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {t.clubPrompt}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {CLUBS.map((club) => (
                <button
                  key={club}
                  type="button"
                  disabled={isPending}
                  onClick={() => pickClub(club)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl bg-secondary text-sm font-medium transition-colors",
                    "hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                  )}
                >
                  {t.clubs[club]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
