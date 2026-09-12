import { ChevronLeft, Minus, Plus, Trophy, Users } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/format";

type Mockups = Dictionary["landing"]["mockups"];

/**
 * Representaciones ilustrativas de la propia interfaz (no interactivas) —
 * capturas de pantalla "falsas" con el mismo look real de la app (misma
 * paleta, mismos componentes), en vez de fotografía, para el hero y la
 * sección de pasos de la landing. Los textos vienen de landing.mockups en
 * el diccionario: son parte de lo que ve el usuario, así que cambian de
 * idioma igual que el resto de la landing (los nombres de jugadores son
 * nombres propios y no se traducen).
 */

function DemoTag() {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-muted-foreground uppercase">
      Demo
    </span>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-[2.2rem] border-4 border-neutral-900 bg-neutral-900 p-1.5 shadow-xl">
      <div className="flex flex-col overflow-hidden rounded-[1.7rem] bg-background">
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
          <span className="text-[10px] font-medium text-muted-foreground">9:41</span>
          <div className="h-4 w-16 rounded-full bg-neutral-900" />
          <span className="text-[10px] text-muted-foreground">●●●</span>
        </div>
        <div className="flex flex-col gap-4 px-4 pt-1 pb-6">{children}</div>
      </div>
    </div>
  );
}

export function LobbyMockup({ t }: { t: Mockups["lobby"] }) {
  return (
    <PhoneFrame>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ChevronLeft className="size-3.5" />
        {t.createGame}
      </div>
      <div className="rounded-2xl bg-secondary p-3.5">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">{t.courseName}</p>
          <DemoTag />
        </div>
        <p className="text-xs text-muted-foreground">{t.courseLocation}</p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.players}</p>
        <div className="flex -space-x-2">
          {["A", "J", "P", "M"].map((initial) => (
            <span
              key={initial}
              className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-accent text-[10px] font-medium text-accent-foreground"
            >
              {initial}
            </span>
          ))}
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-dashed border-border text-[10px] text-muted-foreground">
            +
          </span>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
        <div className="flex items-center gap-2 px-3.5 py-2.5">
          <Users className="size-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium">{t.gameMode}</p>
            <p className="text-[11px] text-muted-foreground">{t.gameModeValue}</p>
          </div>
        </div>
        <div className="px-3.5 py-2.5">
          <p className="text-xs font-medium">{t.bet}</p>
          <p className="text-[11px] text-muted-foreground">{t.betValue}</p>
        </div>
      </div>
      <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">
        {t.start}
      </div>
    </PhoneFrame>
  );
}

export function ScorecardMockup({ t, holeNumber = 7 }: { t: Mockups["scorecard"]; holeNumber?: number }) {
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <ChevronLeft className="size-3.5" />
        {t.exit}
      </div>
      <div className="text-center">
        <p className="font-heading text-2xl tracking-tight">{fmt(t.hole, { n: holeNumber })}</p>
        <p className="mt-0.5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          {t.parCourse} <DemoTag />
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {[
          { name: "Antonio", strokes: 5 },
          { name: "Juan", strokes: 4 },
          { name: "Pablo", strokes: 5 },
          { name: "Miguel", strokes: 6 },
        ].map((p) => (
          <div key={p.name} className="flex items-center justify-between">
            <span className="text-sm font-medium">{p.name}</span>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full border border-border">
                <Minus className="size-3" />
              </span>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-heading text-primary-foreground">
                {p.strokes}
              </span>
              <span className="flex size-6 items-center justify-center rounded-full border border-border">
                <Plus className="size-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">
        {t.save}
      </div>
    </PhoneFrame>
  );
}

export function MindAnalysisMockup({ t }: { t: Mockups["analysis"] }) {
  return (
    <PhoneFrame>
      <p className="font-heading text-base font-semibold">{t.title}</p>
      <div className="mr-auto max-w-[92%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5 text-xs text-secondary-foreground">
        {t.message}
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          { label: t.statResult, value: "87" },
          { label: t.statPar, value: "4" },
          { label: t.statBogeys, value: "8" },
          { label: t.statBirdies, value: "3" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border py-2">
            <p className="font-heading text-sm font-semibold">{stat.value}</p>
            <p className="text-[9px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-accent p-3">
        <p className="text-[10px] font-medium text-accent-foreground">{t.learningLabel}</p>
        <p className="mt-1 text-xs text-accent-foreground">{t.learningBody}</p>
      </div>
    </PhoneFrame>
  );
}

export function ResultMockup({ t }: { t: Mockups["result"] }) {
  return (
    <PhoneFrame>
      <p className="text-center font-heading text-base font-semibold">{t.finished}</p>
      <p className="-mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        {t.courseSummary} <DemoTag />
      </p>
      <div className="flex flex-col items-center gap-1 text-center">
        <Trophy className="size-6 text-primary" />
        <p className="font-heading text-xl">Antonio</p>
        <p className="text-sm text-muted-foreground">87 {t.strokesSuffix}</p>
      </div>
      <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Juan</span>
          <span>89</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Pablo</span>
          <span>92</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Miguel</span>
          <span>94</span>
        </div>
      </div>
      <div className="rounded-xl bg-secondary py-2 text-center text-xs font-medium text-secondary-foreground">
        {t.betResult}
      </div>
      <div className="rounded-xl bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">
        {t.viewAnalysis}
      </div>
      <p className="text-center text-xs font-medium text-muted-foreground">{t.rematch}</p>
    </PhoneFrame>
  );
}

export function RivalryCard({ t }: { t: Mockups["rivalry"] }) {
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-center text-xs font-medium text-muted-foreground">Antonio vs Juan</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-center">
          <p className="font-heading text-2xl font-semibold">5</p>
          <p className="text-[11px] text-muted-foreground">Antonio</p>
        </div>
        <div className="text-center text-muted-foreground">
          <p className="font-heading text-lg">8</p>
          <p className="text-[10px]">{t.games}</p>
        </div>
        <div className="text-center">
          <p className="font-heading text-2xl font-semibold">3</p>
          <p className="text-[11px] text-muted-foreground">Juan</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-primary py-2 text-center text-xs font-medium text-primary-foreground">
        {t.rematch}
      </div>
    </div>
  );
}
