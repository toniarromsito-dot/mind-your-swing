"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { ChevronLeft, Loader2, MoreHorizontal, Check } from "lucide-react";
import { SharedScorecard } from "@/components/shared-scorecard";
import { MindQuickCard } from "@/components/mind-quick-card";
import { FinishGameDrawer } from "@/components/finish-game-drawer";
import { OfflineStatusBadge } from "@/components/offline-status-badge";
import { gamePlayingHandicapForIndex } from "@/lib/games/handicap";
import { setBackButtonHandler } from "@/lib/native/back-button";
import { useOfflineGame } from "@/lib/offline/use-offline-game";
import { scoreKey, type LocalScoreEntry } from "@/lib/offline/types";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

/** Referencia estable para cuando todavía no hay snapshot local — evita recrear el objeto (y por tanto los useMemo que dependen de él) en cada render. */
const EMPTY_SCORES: Record<string, LocalScoreEntry> = {};

type GameForView = {
  id: string;
  course: string;
  status: "IN_PROGRESS" | "COMPLETED";
  totalHoles: number;
  teeCourseRating: number | null;
  teeSlope: number | null;
  teeParTotal: number | null;
  teeHoleCount: number | null;
  handicapAllowance: number | null;
  holes: { id: string; number: number; par: number; distance: number | null; index: number | null }[];
  players: {
    id: string;
    user: { name: string | null; image: string | null; handicap: number | null };
    playingHandicap: number | null;
    scores: { holeId: string; strokes: number | null; putts: number | null }[];
  }[];
};

/**
 * Focus Mode: durante la vuelta la app no muestra nada más que el
 * scorecard — sin standings, sin retos, sin chat con el compañero. Ver
 * brief: "durante la vuelta, Mind desaparece." El icono de Mind en la
 * cabecera abre una tarjeta corta en el sitio (MindQuickCard), nunca el
 * chat completo — Mind nunca interrumpe solo. Al volver, la vuelta
 * reanuda exactamente donde estaba porque la posición del hoyo se
 * recalcula siempre a partir de lo ya guardado (ahora: del snapshot local
 * reconciliado con el servidor — ver useOfflineGame), no de estado
 * volátil.
 *
 * Offline-First (fase aprobada): todo el scorecard opera local-first —
 * introducir/navegar/modificar golpes nunca depende de la red una vez
 * cargada la partida; solo la sincronización de fondo la necesita. Ver
 * src/lib/offline/ para el diseño completo.
 */
export function GameView({
  game,
  t,
  golfResult,
}: {
  game: GameForView;
  t: Dictionary["playGame"];
  golfResult: Dictionary["golfResult"];
}) {
  const router = useRouter();
  const [isFinishing, startFinishing] = useTransition();
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const preloadErrorShown = useRef(false);

  const serverSnapshot = useMemo(
    () => ({
      id: game.id,
      course: game.course,
      status: game.status,
      totalHoles: game.totalHoles,
      teeCourseRating: game.teeCourseRating,
      teeSlope: game.teeSlope,
      teeParTotal: game.teeParTotal,
      teeHoleCount: game.teeHoleCount,
      handicapAllowance: game.handicapAllowance,
      holes: game.holes,
      players: game.players.map((p) => ({
        id: p.id,
        userId: p.id, // GamePlayer.id ya es el identificador estable que usa el scorecard; no hace falta el userId real aquí.
        name: p.user.name ?? "Jugador",
        image: p.user.image,
        playingHandicap: p.playingHandicap,
        userHandicap: p.user.handicap,
        scores: p.scores,
      })),
    }),
    [game]
  );

  const { localGame, status, preloadError, finishConfirmed, recordScore, requestFinish } = useOfflineGame(serverSnapshot);

  // Bloque 3 — "si no se puede preparar correctamente el estado local, no
  // permitir entrar en una situación aparentemente offline sin avisar":
  // un único aviso si el respaldo local de esta partida no se pudo
  // preparar (Preferences falló por algún motivo). No bloquea jugar
  // online, solo informa de que el respaldo offline no está listo.
  useEffect(() => {
    if (preloadError && !preloadErrorShown.current) {
      preloadErrorShown.current = true;
      toast.error(t.offlinePreloadError);
    }
  }, [preloadError, t.offlinePreloadError]);

  const holes = localGame?.holes ?? game.holes;
  const players = localGame?.players ?? serverSnapshot.players;
  const scores = localGame?.scores ?? EMPTY_SCORES;

  const firstUnplayedIndex = holes.findIndex((h) =>
    players.some((p) => {
      const local = scores[scoreKey(h.id, p.id)];
      if (local) return local.strokes == null;
      const serverScore = game.players.find((sp) => sp.id === p.id)?.scores.find((s) => s.holeId === h.id);
      return (serverScore?.strokes ?? null) == null;
    })
  );
  const [holeIndex, setHoleIndex] = useState(firstUnplayedIndex === -1 ? holes.length - 1 : firstUnplayedIndex);

  const hole = holes[holeIndex];
  const isLastHole = holeIndex === holes.length - 1;

  useEffect(() => {
    setBackButtonHandler(() => setConfirmFinishOpen(true));
    return () => setBackButtonHandler(null);
  }, []);

  const scorecardPlayers = useMemo(
    () =>
      players.map((p) => {
        const local = scores[scoreKey(hole.id, p.id)];
        const strokes = local ? local.strokes : (game.players.find((sp) => sp.id === p.id)?.scores.find((s) => s.holeId === hole.id)?.strokes ?? null);
        return {
          id: p.id,
          name: p.name,
          handicap: p.playingHandicap ?? gamePlayingHandicapForIndex(serverSnapshot, p.userHandicap),
          strokes,
        };
      }),
    [players, scores, hole.id, game.players, serverSnapshot]
  );

  function goToNextHole() {
    if (isLastHole) {
      finishRound();
    } else {
      setHoleIndex((i) => i + 1);
    }
  }

  function finishRound() {
    startFinishing(async () => {
      await requestFinish();
      // La navegación NUNCA se decide aquí por una comprobación de
      // conectividad optimista ni por releer el estado local — se dispara
      // solo desde el efecto de abajo, cuando `finishConfirmed` refleja una
      // confirmación real y explícita del propio syncGame() (ver
      // useOfflineGame). Si seguimos sin conexión, o el finish quedó
      // bloqueado porque aún queda algún Score sin sincronizar, la pantalla
      // de "vuelta completada, pendiente de sincronizar" permanece hasta
      // que la sincronización real lo confirme.
    });
  }

  function confirmFinish() {
    setConfirmFinishOpen(false);
    finishRound();
  }

  // Única vía de navegación tras finalizar: `finishConfirmed` es una señal
  // explícita que solo se activa a partir del resultado devuelto por
  // syncGame() (o de una llamada a requestFinish() sobre una partida que ya
  // estaba sincronizada del todo) — nunca depende de releer `localGame`
  // después de que su propio storage pueda haber sido limpiado.
  useEffect(() => {
    if (finishConfirmed) {
      router.push(`/play/${game.id}/resumen`);
    }
  }, [finishConfirmed, game.id, router]);

  const finishedLocallyOffline =
    localGame?.localStatus === "completed_pending_sync" && localGame.finishSyncStatus !== "synced";

  return (
    // Focus Mode se pinta por encima de TODO (fixed inset-0, z por delante
    // del header/bottom nav de AppShell): "durante la vuelta, la app
    // desaparece" — nada de navegación inferior ni cabecera de la app
    // visibles ni pulsables mientras se juega. Franja de foto arriba (misma
    // identidad visual que el resto de Jugar) + hoja blanca redondeada
    // debajo con el scorecard real, sin quitar ningún control existente
    // (hoyo anterior, Mind, terminar antes) — solo reubicados sobre la foto.
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="relative h-[26vh] min-h-[190px] shrink-0 overflow-hidden">
        <Image
          src="/images/play-hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_70%]"
          priority
        />
        <div className="relative flex h-full flex-col justify-between px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setHoleIndex((i) => Math.max(0, i - 1))}
              disabled={holeIndex === 0}
              className="flex items-center gap-1 rounded-full bg-white/15 py-1 pr-2.5 pl-1.5 text-sm text-white backdrop-blur-sm disabled:opacity-0"
            >
              <ChevronLeft className="size-4" />
              {t.previousHole}
            </button>
            <p className="truncate px-2 text-xs font-medium text-white/85">{game.course}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <OfflineStatusBadge status={status} t={t} />
              <MindQuickCard gameId={game.id} holeId={hole.id} t={t.quickCoach} />
              {/* En el último hoyo, guardar el resultado ya termina la
                  partida — no hay ninguna acción útil que ofrecer aquí, así
                  que el menú entero desaparece en vez de dejar un "⋯" sin
                  nada dentro. */}
              {!isLastHole && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t.moreOptionsLabel}
                    className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setConfirmFinishOpen(true)}>{t.finishEarly}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="text-center text-white">
            <h1 className="font-heading text-3xl font-bold">
              {fmt(t.hole, { n: hole.number, total: holes.length })}
            </h1>
            <p className="mt-0.5 text-base text-white/85">
              {t.par} {hole.par}
            </p>
          </div>
        </div>
      </div>

      <div className="relative -mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl bg-background pb-[env(safe-area-inset-bottom)]">
        {isFinishing || finishedLocallyOffline ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            {finishedLocallyOffline ? (
              <>
                <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Check className="size-6" />
                </span>
                <p className="font-heading text-lg font-semibold text-foreground">{t.finishConfirmEnd}</p>
                <OfflineStatusBadgeInline status={status} t={t} />
              </>
            ) : (
              <>
                <Loader2 className="size-6 animate-spin" />
                <p>{t.saving}</p>
              </>
            )}
          </div>
        ) : (
          <SharedScorecard
            key={hole.id}
            hole={hole}
            players={scorecardPlayers}
            recordScore={recordScore}
            onSaved={goToNextHole}
            t={t}
            golfResult={golfResult}
          />
        )}
      </div>

      <FinishGameDrawer open={confirmFinishOpen} onOpenChange={setConfirmFinishOpen} onConfirm={confirmFinish} t={t} />
    </div>
  );
}

/** Igual que OfflineStatusBadge pero con fondo sólido — se usa sobre la hoja blanca (pantalla de "vuelta completada"), no sobre la foto. */
function OfflineStatusBadgeInline({ status, t }: { status: string; t: Dictionary["playGame"] }) {
  if (status !== "offline" && status !== "sync_error" && status !== "syncing") return null;
  const label = status === "offline" ? t.offlineOffline : status === "syncing" ? t.offlineSyncing : t.offlinePending;
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
