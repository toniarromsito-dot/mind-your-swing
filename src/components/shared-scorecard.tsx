"use client";

import { useState } from "react";
import { holeResultLabel } from "@/lib/golf";
import { strokesReceivedOnHole } from "@/lib/games/handicap";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

export type ScorecardPlayer = { id: string; name: string; handicap: number | null; strokes: number | null };

const STROKE_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

/**
 * El scorecard durante la vuelta (Focus Mode): un jugador con el móvil en
 * la mano toca el número de golpes de cada compañero, uno detrás de otro,
 * y guarda al instante — nada de steppers, selector de palo ni botón
 * "Guardar" aparte. Ver brief: "miro → toco → guardado → siguiente
 * hoyo".
 *
 * Offline-First: `recordScore` escribe local-first (nunca espera al
 * servidor — ver useOfflineGame) y no lanza nunca, así que la confirmación
 * en pantalla es inmediata tanto online como offline; la sincronización
 * real ocurre en segundo plano.
 */
export function SharedScorecard({
  hole,
  players,
  recordScore,
  onSaved,
  t,
  golfResult,
}: {
  hole: { id: string; number: number; par: number; distance: number | null; index: number | null };
  players: ScorecardPlayer[];
  recordScore: (holeId: string, playerId: string, strokes: number | null, putts: number | null) => void;
  onSaved: () => void;
  t: Dictionary["playGame"];
  golfResult: Dictionary["golfResult"];
}) {
  const [playerIndex, setPlayerIndex] = useState(() => {
    const firstUnset = players.findIndex((p) => p.strokes == null);
    return firstUnset === -1 ? 0 : firstUnset;
  });
  const [confirmation, setConfirmation] = useState<{ strokes: number; label: string } | null>(null);

  const player = players[playerIndex];
  const strokesReceived =
    hole.index != null && player.handicap != null ? strokesReceivedOnHole(player.handicap, hole.index) : 0;

  function pick(strokes: number) {
    if (confirmation) return;
    recordScore(hole.id, player.id, strokes, null);
    setConfirmation({ strokes, label: holeResultLabel(hole.par, strokes, golfResult) });
    setTimeout(() => {
      setConfirmation(null);
      if (playerIndex + 1 < players.length) {
        setPlayerIndex((i) => i + 1);
      } else {
        onSaved();
      }
    }, 1100);
  }

  if (confirmation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <span className="flex size-24 items-center justify-center rounded-full bg-secondary">
          <span className="font-heading text-5xl font-bold">{confirmation.strokes}</span>
        </span>
        <p className="text-sm font-medium text-muted-foreground">{fmt(t.strokesCount, { n: confirmation.strokes })}</p>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {confirmation.label}
        </span>
        <p className="mt-2 text-sm text-muted-foreground">{t.nextHolePrompt}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-6 py-6 text-center">
      {/* El título "Hoyo N/Total · Par" ya lo dibuja GameView sobre la foto
          — aquí solo el resto de datos reales del hoyo, que la foto no
          tiene sitio para mostrar. */}
      <div>
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          {hole.distance != null && <span>{fmt(t.distanceMeters, { n: hole.distance })}</span>}
          {hole.distance != null && hole.index != null && <span className="text-border">·</span>}
          {hole.index != null && <span>{fmt(t.strokeIndexShort, { n: hole.index })}</span>}
        </p>
        {strokesReceived > 0 && (
          <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {strokesReceived === 1 ? t.strokesReceivedOne : fmt(t.strokesReceivedMany, { n: strokesReceived })}
          </span>
        )}
      </div>

      <div>
        {players.length > 1 && <p className="text-sm font-medium text-muted-foreground">{player.name}</p>}
        <p className="mt-1 font-heading text-xl font-semibold">{t.howManyStrokes}</p>
      </div>

      <div className="grid w-full max-w-sm grid-cols-4 gap-3">
        {STROKE_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pick(n)}
            className="flex aspect-square items-center justify-center rounded-2xl bg-secondary font-heading text-2xl font-semibold text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
