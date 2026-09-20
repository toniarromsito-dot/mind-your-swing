"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Calendar, Users, FileText, Plus, X, Search, Mail, Share2 } from "lucide-react";
import { createGame, searchPlayersToInvite, type ActionState } from "@/actions/games";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { modesForPlayerCount, GAME_MODE_META } from "@/lib/games/modes";
import { resolveGameHandicap } from "@/lib/games/handicap";
import type { GameMode } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/i18n/format";

type CourseTee = {
  id: string;
  name: string;
  category: string | null;
  parTotal: number | null;
  distanceTotal: number | null;
  courseRating: number | null;
  slope: number | null;
};

type CourseLayout = {
  id: string;
  name: string;
  holeCount: number | null;
  tees: CourseTee[];
};

type RealCourse = {
  id: string;
  name: string;
  location: string | null;
  layouts: CourseLayout[];
};

function teeMetaLabel(tee: CourseTee): string {
  const parts: string[] = [];
  if (tee.category) parts.push(tee.category);
  if (tee.distanceTotal != null) parts.push(`${tee.distanceTotal} m`);
  if (tee.courseRating != null) parts.push(`CR ${tee.courseRating}`);
  if (tee.slope != null) parts.push(`Slope ${tee.slope}`);
  return parts.join(" · ");
}

type InvitablePlayer = { id: string; name: string | null; image: string | null; handicap: number | null };

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toTimeInputValue(d: Date) {
  return d.toISOString().slice(11, 16);
}

function Avatar({ name, image, size = 40 }: { name: string | null; image: string | null; size?: number }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? ""}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name?.[0] ?? "?"}
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof MapPin;
  label: string;
  value: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-3xl bg-card/95 p-3.5 text-left shadow-sm backdrop-blur-sm"
    >
      <span className="flex size-9 shrink-0 items-center justify-center text-primary">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="block truncate text-base font-semibold">{value}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function NewGameScreen({
  courses,
  t,
  playT,
  isPro,
  me,
}: {
  courses: RealCourse[];
  t: Dictionary["newGame"];
  playT: Dictionary["play"];
  isPro: boolean;
  me: { name: string | null; image: string | null; handicap: number | null };
}) {
  const now = useMemo(() => new Date(), []);
  const [selectedCourse, setSelectedCourse] = useState<RealCourse | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<CourseLayout | null>(null);
  const [selectedTee, setSelectedTee] = useState<CourseTee | null>(null);
  const [freeTextCourse, setFreeTextCourse] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [date, setDate] = useState(toDateInputValue(now));
  const [time, setTime] = useState(toTimeInputValue(now));
  const [players, setPlayers] = useState<InvitablePlayer[]>([]);
  // Cuántos jugadores va a tener la partida en total — se elige libremente
  // (como en el asistente antiguo), independiente de a cuántos se
  // encuentra por nombre: los huecos que no se rellenen aquí se quedan
  // abiertos para unirse después con el código de invitación (mismo flujo
  // que ya existe en el lobby), nunca bloquea la partida a "tú solo".
  const [manualCount, setManualCount] = useState(1);
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [mode, setMode] = useState<GameMode>("STROKE_PLAY");

  const [courseDrawerOpen, setCourseDrawerOpen] = useState(false);
  const [layoutDrawerOpen, setLayoutDrawerOpen] = useState(false);
  const [teeDrawerOpen, setTeeDrawerOpen] = useState(false);
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [playersDrawerOpen, setPlayersDrawerOpen] = useState(false);
  const [formatDrawerOpen, setFormatDrawerOpen] = useState(false);

  // El recorrido solo tiene 9 hoyos reales para Pollença, Santa Ponsa III
  // y Palma Pitch & Putt — "18 hoyos" sigue disponible, pero juega esa
  // misma tarjeta de 9 dos veces (GameHole 10-18 clona 1-9 en el servidor,
  // GolfCourseTeeHole nunca gana filas nuevas). Ver resolveGameHoles.
  const layoutIsNineHoles = selectedLayout?.holeCount === 9;

  // Por defecto se propone "9 hoyos" al elegir un recorrido de 9 (la
  // opción más directa), pero el usuario puede cambiar a 18 libremente.
  function selectLayoutHoleCount(layout: CourseLayout) {
    if (layout.holeCount === 9) setHoleCount(9);
  }

  // Tras elegir un campo, si solo hay un recorrido se selecciona solo; si
  // ese único recorrido además solo tiene un tee, se selecciona también y
  // no hace falta abrir ningún otro drawer.
  function pickCourse(c: RealCourse) {
    setSelectedCourse(c);
    setFreeTextCourse("");
    setCourseDrawerOpen(false);
    if (c.layouts.length === 1) {
      pickLayout(c.layouts[0]);
    } else {
      setSelectedLayout(null);
      setSelectedTee(null);
      setLayoutDrawerOpen(true);
    }
  }

  function pickLayout(layout: CourseLayout) {
    setSelectedLayout(layout);
    setLayoutDrawerOpen(false);
    selectLayoutHoleCount(layout);
    if (layout.tees.length === 1) {
      setSelectedTee(layout.tees[0]);
    } else {
      setSelectedTee(null);
      setTeeDrawerOpen(true);
    }
  }

  function pickTee(tee: CourseTee) {
    setSelectedTee(tee);
    setTeeDrawerOpen(false);
  }

  const courseFieldValue = selectedCourse
    ? [selectedCourse.name, selectedLayout?.name, selectedTee ? teeLabel(selectedTee) : null].filter(Boolean).join(" · ")
    : freeTextCourse || "—";

  function teeLabel(tee: CourseTee) {
    return tee.category ? `${tee.name} (${tee.category})` : tee.name;
  }

  const courseSelectionComplete = selectedCourse ? Boolean(selectedLayout && selectedTee) : Boolean(freeTextCourse.trim());

  // Vista previa del hándicap de juego, en cuanto hay tee elegido y el
  // jugador tiene un Handicap Index declarado — misma función pura que usa
  // el servidor al crear la partida (createGame), así el número que se ve
  // aquí es exactamente el que se guardará.
  const handicapPreview = useMemo(() => {
    if (!selectedTee || me.handicap == null) return null;
    return resolveGameHandicap(
      me.handicap,
      holeCount,
      {
        courseRating: selectedTee.courseRating,
        slope: selectedTee.slope,
        parTotal: selectedTee.parTotal,
        teeHoleCount: selectedLayout?.holeCount === 9 ? 9 : selectedLayout?.holeCount === 18 ? 18 : null,
      },
      1
    );
  }, [selectedTee, selectedLayout, holeCount, me.handicap]);

  const [playerQuery, setPlayerQuery] = useState("");
  const [playerResults, setPlayerResults] = useState<InvitablePlayer[]>([]);
  const [isSearching, startSearching] = useTransition();
  const [inviteBlocked, setInviteBlocked] = useState(false);

  const [state, formAction, pending] = useActionState<ActionState, FormData>(createGame, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // El código de invitación solo existe una vez creada la partida — "invitar
  // ya" desde este paso adelanta el mismo envío que hace el botón "Crear",
  // así se aterriza directo en el lobby (/play/[id]) donde el botón
  // "Invitar" real (WhatsApp/email) ya funciona, sin duplicar esa lógica aquí.
  function handleInviteNow() {
    if (!courseSelectionComplete) {
      setInviteBlocked(true);
      return;
    }
    setInviteBlocked(false);
    formRef.current?.requestSubmit();
  }

  const playerCount = Math.max(manualCount, 1 + players.length);
  const openSlots = playerCount - 1 - players.length;
  const availableModes = useMemo(() => modesForPlayerCount(playerCount), [playerCount]);

  useEffect(() => {
    // El debounce del setTimeout ya aplaza el setState fuera del cuerpo
    // síncrono del efecto (incluido el caso "consulta demasiado corta").
    const handle = setTimeout(() => {
      const trimmed = playerQuery.trim();
      if (trimmed.length < 2) {
        setPlayerResults([]);
        return;
      }
      startSearching(async () => {
        const results = await searchPlayersToInvite(trimmed);
        setPlayerResults(results.filter((r) => !players.some((p) => p.id === r.id)));
      });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerQuery]);

  const filteredCourses = useMemo(
    () => courses.filter((c) => c.name.toLowerCase().includes(courseQuery.toLowerCase())),
    [courses, courseQuery]
  );

  function syncModeToCount(nextCount: number) {
    const nextModes = modesForPlayerCount(nextCount);
    if (!nextModes.includes(mode)) setMode(nextModes[0] ?? "STROKE_PLAY");
  }

  function pickCount(n: number) {
    setManualCount(n);
    syncModeToCount(Math.max(n, 1 + players.length));
  }

  function addPlayer(player: InvitablePlayer) {
    if (players.length >= 3) return;
    setPlayers((prev) => [...prev, player]);
    syncModeToCount(Math.max(manualCount, playerCount + 1));
    setPlayerQuery("");
    setPlayerResults([]);
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    syncModeToCount(Math.max(manualCount, playerCount - 1));
  }

  const combinedDate = new Date(`${date}T${time}`);
  const dateLabel = combinedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

  return (
    <div className="relative h-svh overflow-hidden">
      <Image src="/images/play-hero.jpg" alt="" fill sizes="100vw" className="object-cover" priority />
      <div className="relative flex h-full flex-col px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/play"
            aria-label={playT.backLabel}
            className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <span className="text-sm font-medium text-white">{playT.backLabel}</span>
        </div>

        <div className="mt-4 shrink-0">
          <p className="text-xs font-semibold tracking-[0.25em] text-white/80 uppercase">{playT.heroEyebrow}</p>
          <h1 className="mt-1 font-heading text-3xl leading-tight font-bold text-white">{t.heroHeadline}</h1>
          <p className="mt-1 text-sm text-white/85">{t.heroTagline}</p>
        </div>

        <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-2.5">
          <input type="hidden" name="playerCount" value={playerCount} />
          <input type="hidden" name="mode" value={mode} />
          {selectedCourse ? (
            <>
              <input type="hidden" name="courseId" value={selectedCourse.id} />
              {selectedLayout && <input type="hidden" name="courseLayoutId" value={selectedLayout.id} />}
              {selectedTee && <input type="hidden" name="courseTeeId" value={selectedTee.id} />}
            </>
          ) : (
            <input type="hidden" name="course" value={freeTextCourse} />
          )}
          <input
            type="hidden"
            name="date"
            value={Number.isNaN(combinedDate.getTime()) ? "" : combinedDate.toISOString()}
          />
          <input type="hidden" name="holeCount" value={holeCount} />
          {players.map((p) => (
            <input key={p.id} type="hidden" name="playerIds" value={p.id} />
          ))}

          <SettingRow
            icon={MapPin}
            label={t.courseFieldLabel}
            value={courseFieldValue}
            onClick={() => setCourseDrawerOpen(true)}
          />

          {/* Vista previa simple del hándicap de juego — una sola línea,
              sin Course Rating/Slope/fórmulas: eso vive solo en el
              informe final de esta fase, nunca en la pantalla del
              jugador. Solo aparece cuando hay tee elegido y HI declarado. */}
          {selectedTee && me.handicap != null && (
            <div className="rounded-3xl bg-card/95 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
              {handicapPreview?.available ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">{t.playingHandicapLabel}</p>
                  <p className="font-heading text-lg font-semibold">
                    {fmt(t.playingHandicapValue, { n: handicapPreview.playingHandicap })}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t.playingHandicapUnavailableHint}</p>
              )}
            </div>
          )}

          <SettingRow
            icon={Calendar}
            label={t.dateFieldLabel}
            value={`${dateLabel} · ${time}`}
            onClick={() => setDateDrawerOpen(true)}
          />

          <div className="flex flex-col gap-2.5 rounded-3xl bg-card/95 p-3.5 shadow-sm backdrop-blur-sm">
            <button type="button" onClick={() => setPlayersDrawerOpen(true)} className="flex w-full items-center gap-3 text-left">
              <span className="flex size-9 shrink-0 items-center justify-center text-primary">
                <Users className="size-5" strokeWidth={1.5} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-muted-foreground">{t.playersFieldLabel}</span>
                <span className="block text-base font-semibold">
                  {playerCount === 1 ? t.onePlayerLabel : fmt(t.playersCountLabel, { n: playerCount })}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex w-14 flex-col items-center gap-0.5">
                <Avatar name={me.name} image={me.image} size={34} />
                <span className="max-w-14 truncate text-[10px] text-muted-foreground">{t.youLabel}</span>
              </div>
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => removePlayer(p.id)}
                  className="group flex w-14 flex-col items-center gap-0.5"
                >
                  <span className="relative">
                    <Avatar name={p.name} image={p.image} size={34} />
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <X className="size-2.5" />
                    </span>
                  </span>
                  <span className="max-w-14 truncate text-[10px] text-muted-foreground">{p.name}</span>
                </button>
              ))}
              {Array.from({ length: openSlots }).map((_, i) => (
                <button
                  key={`open-${i}`}
                  type="button"
                  onClick={() => setPlayersDrawerOpen(true)}
                  className="flex w-14 flex-col items-center gap-0.5"
                >
                  <span className="flex size-[34px] items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground">
                    <Mail className="size-3.5" />
                  </span>
                  <span className="max-w-14 truncate text-[10px] text-muted-foreground">{t.openSlotLabel}</span>
                </button>
              ))}
              {playerCount < 4 && (
                <button
                  type="button"
                  onClick={() => setPlayersDrawerOpen(true)}
                  className="flex w-14 flex-col items-center gap-0.5"
                >
                  <span className="flex size-[34px] items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground">
                    <Plus className="size-4" />
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t.addLabel}</span>
                </button>
              )}
            </div>
          </div>

          <SettingRow
            icon={FileText}
            label={t.formatFieldLabel}
            value={`${fmt(t.holeCountOption, { n: holeCount })} · ${t.modeLabels[mode]}`}
            onClick={() => setFormatDrawerOpen(true)}
          />

          {state?.error && <p className="text-sm text-white">{state.error}</p>}

          <Button
            type="submit"
            size="lg"
            disabled={pending || !courseSelectionComplete}
            className="h-12 gap-2 rounded-2xl text-base"
          >
            {pending ? t.creating : t.create}
          </Button>
        </form>
      </div>

      {/* Campo de golf */}
      <Drawer open={courseDrawerOpen} onOpenChange={setCourseDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.courseFieldLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                placeholder={t.searchCoursePlaceholder}
                className="h-10 pl-9"
              />
            </div>
            <div className="flex flex-col gap-2">
              {filteredCourses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCourse(c)}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary hover:bg-secondary/40"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.location && <p className="text-xs text-muted-foreground">{c.location}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {c.layouts.length === 1 ? c.layouts[0].name : fmt(t.layoutsCountLabel, { n: c.layouts.length })}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-sm font-medium">{t.noCourseFound}</p>
              <div className="flex gap-2">
                <Input
                  value={freeTextCourse}
                  onChange={(e) => setFreeTextCourse(e.target.value)}
                  placeholder={t.courseNamePlaceholder}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!freeTextCourse.trim()) return;
                    setSelectedCourse(null);
                    setSelectedLayout(null);
                    setSelectedTee(null);
                    setCourseDrawerOpen(false);
                  }}
                >
                  {t.use}
                </Button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Recorrido */}
      <Drawer open={layoutDrawerOpen} onOpenChange={setLayoutDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.layoutFieldLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">{t.chooseLayoutPrompt}</p>
            {selectedCourse?.layouts.map((layout) => (
              <button
                key={layout.id}
                type="button"
                onClick={() => pickLayout(layout)}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary hover:bg-secondary/40"
              >
                <p className="font-medium">{layout.name}</p>
                <span className="text-xs text-muted-foreground">{fmt(t.teesCountLabel, { n: layout.tees.length })}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Tee de salida */}
      <Drawer open={teeDrawerOpen} onOpenChange={setTeeDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.teeFieldLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            <p className="text-sm text-muted-foreground">{t.chooseTeePrompt}</p>
            {selectedLayout?.tees.map((tee) => (
              <button
                key={tee.id}
                type="button"
                onClick={() => pickTee(tee)}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary hover:bg-secondary/40"
              >
                <p className="font-medium">{tee.name}</p>
                <span className="text-xs text-muted-foreground">{teeMetaLabel(tee)}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Fecha y hora */}
      <Drawer open={dateDrawerOpen} onOpenChange={setDateDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.dateFieldLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t.dateLabel}</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t.timeLabel}</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <DrawerFooter>
            <Button type="button" onClick={() => setDateDrawerOpen(false)}>
              {t.doneLabel}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Jugadores */}
      <Drawer open={playersDrawerOpen} onOpenChange={setPlayersDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.playersFieldLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{t.howManyPlayers}</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={n < 1 + players.length}
                    onClick={() => pickCount(n)}
                    className={cn(
                      "rounded-xl border py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      playerCount === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary hover:bg-secondary/40"
                    )}
                  >
                    {n === 1 ? t.onePlayerLabel : n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm">
                <Avatar name={me.name} image={me.image} size={20} />
                {me.name} ({t.youLabel})
              </span>
              {players.map((p) => (
                <span key={p.id} className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm">
                  <Avatar name={p.name} image={p.image} size={20} />
                  {p.name}
                  <button type="button" onClick={() => removePlayer(p.id)} aria-label={t.removeLabel}>
                    <X className="size-3.5 text-muted-foreground" />
                  </button>
                </span>
              ))}
              {Array.from({ length: openSlots }).map((_, i) => (
                <span
                  key={`open-${i}`}
                  className="flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
                >
                  <Mail className="size-3.5" />
                  {t.openSlotLabel}
                </span>
              ))}
            </div>

            {openSlots > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleInviteNow}
                  disabled={pending}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-60"
                >
                  <Share2 className="size-4" />
                  {t.inviteNowLabel}
                </button>
                {inviteBlocked && <p className="text-xs text-destructive">{t.chooseCourseFirstHint}</p>}
                <p className="text-sm font-medium">{t.playersSearchLabel}</p>
                <p className="text-xs text-muted-foreground">{t.playersInviteHint}</p>
                <div className="relative">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={playerQuery}
                    onChange={(e) => setPlayerQuery(e.target.value)}
                    placeholder={t.playersSearchPlaceholder}
                    className="h-10 pl-9"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {isSearching && <p className="text-sm text-muted-foreground">…</p>}
                  {!isSearching && playerQuery.trim().length >= 2 && playerResults.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t.playersNoResults}</p>
                  )}
                  {playerResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addPlayer(p)}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-secondary/40"
                    >
                      <Avatar name={p.name} image={p.image} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        {p.handicap != null && (
                          <span className="block text-xs text-muted-foreground">{fmt(t.handicapLabel, { n: p.handicap })}</span>
                        )}
                      </span>
                      <Plus className="size-4 shrink-0 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DrawerFooter>
            <Button type="button" onClick={() => setPlayersDrawerOpen(false)}>
              {t.doneLabel}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Formato de la vuelta */}
      <Drawer open={formatDrawerOpen} onOpenChange={setFormatDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.formatFieldLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">{t.holeCountLabel}</p>
              <div className="grid grid-cols-2 gap-2">
                {([9, 18] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setHoleCount(n)}
                    className={cn(
                      "rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                      holeCount === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary hover:bg-secondary/40"
                    )}
                  >
                    {fmt(t.holeCountOption, { n })}
                  </button>
                ))}
              </div>
              {layoutIsNineHoles && holeCount === 18 && (
                <p className="text-xs text-muted-foreground">{t.nineHoleLayoutDoubledHint}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t.howToPlay}</p>
              {availableModes.map((m) => {
                const locked = GAME_MODE_META[m].pro && !isPro;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={locked}
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex items-center justify-between rounded-2xl border p-4 text-left transition-colors",
                      locked
                        ? "cursor-not-allowed border-border bg-muted/50 opacity-60"
                        : mode === m
                          ? "border-primary bg-secondary/50"
                          : "border-border bg-card hover:border-primary hover:bg-secondary/40"
                    )}
                  >
                    <div>
                      <p className="font-medium">{t.modeLabels[m]}</p>
                      <p className="text-xs text-muted-foreground">{t.modeDescriptions[m]}</p>
                    </div>
                    {locked && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Pro</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <DrawerFooter>
            <Button type="button" onClick={() => setFormatDrawerOpen(false)}>
              {t.doneLabel}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
