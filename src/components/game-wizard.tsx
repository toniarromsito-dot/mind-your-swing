"use client";

import { useActionState, useMemo, useState } from "react";
import { Search, ChevronLeft } from "lucide-react";
import { createGame, type ActionState } from "@/actions/games";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { modesForPlayerCount, GAME_MODE_META } from "@/lib/games/modes";
import type { GameMode } from "@prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

type DemoCourse = {
  id: string;
  name: string;
  location: string | null;
  holes: { number: number; par: number; index: number | null; distance: number | null }[];
};

type Step = "count" | "mode" | "course" | "confirm";

export function GameWizard({ courses, t, isPro }: { courses: DemoCourse[]; t: Dictionary["newGame"]; isPro: boolean }) {
  const [step, setStep] = useState<Step>("count");
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<DemoCourse | null>(null);
  const [freeTextCourse, setFreeTextCourse] = useState("");

  const [state, formAction, pending] = useActionState<ActionState, FormData>(createGame, undefined);

  const filteredCourses = useMemo(
    () => courses.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [courses, query]
  );

  function pickCount(count: number) {
    setPlayerCount(count);
    if (count === 1) {
      setMode("SOLO");
      setStep("course");
    } else {
      setMode(null);
      setStep("mode");
    }
  }

  function pickMode(m: GameMode) {
    setMode(m);
    setStep("course");
  }

  function pickCourse(course: DemoCourse) {
    setSelectedCourse(course);
    setFreeTextCourse("");
    setStep("confirm");
  }

  function useFreeText() {
    if (!freeTextCourse.trim()) return;
    setSelectedCourse(null);
    setStep("confirm");
  }

  function back() {
    if (step === "mode") setStep("count");
    else if (step === "course") setStep(playerCount === 1 ? "count" : "mode");
    else if (step === "confirm") setStep("course");
  }

  return (
    <div className="flex flex-col gap-6">
      {step !== "count" && (
        <button
          type="button"
          onClick={back}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t.back}
        </button>
      )}

      {step === "count" && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-xl">{t.howManyPlayers}</h2>
          <div className="grid grid-cols-3 gap-3">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => pickCount(n)}
                className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card py-8 transition-colors hover:border-primary hover:bg-secondary/40"
              >
                <span className="font-heading text-4xl">{n}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => pickCount(1)}
            className="self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {t.playSolo}
          </button>
        </div>
      )}

      {step === "mode" && playerCount && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-xl">{t.howToPlay}</h2>
          <p className="text-sm text-muted-foreground">{fmtRecommendation(t, playerCount)}</p>
          <div className="flex flex-col gap-3">
            {modesForPlayerCount(playerCount).map((m, i) => {
              const locked = GAME_MODE_META[m].pro && !isPro;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={locked}
                  onClick={() => pickMode(m)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border p-4 text-left transition-colors",
                    locked
                      ? "cursor-not-allowed border-border bg-muted/50 opacity-60"
                      : "border-border bg-card hover:border-primary hover:bg-secondary/40"
                  )}
                >
                  <div>
                    <p className="font-medium">{t.modeLabels[m]}</p>
                    <p className="text-xs text-muted-foreground">{t.modeDescriptions[m]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {i === 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{t.recommended}</span>}
                    {locked && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">Pro</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "course" && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-xl">{t.whereToPlay}</h2>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                <span className="text-xs text-muted-foreground">{c.holes.length} {t.holes}</span>
              </button>
            ))}
          </div>
          <p className="rounded-lg bg-secondary/30 p-2 text-center text-xs text-muted-foreground">{t.demoDataNotice}</p>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <Label htmlFor="free-course">{t.noCourseFound}</Label>
            <div className="flex gap-2">
              <Input
                id="free-course"
                value={freeTextCourse}
                onChange={(e) => setFreeTextCourse(e.target.value)}
                placeholder={t.courseNamePlaceholder}
              />
              <Button type="button" variant="outline" onClick={useFreeText}>
                {t.use}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "confirm" && mode && playerCount && (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="playerCount" value={playerCount} />
          <input type="hidden" name="mode" value={mode} />
          {selectedCourse ? (
            <input type="hidden" name="courseId" value={selectedCourse.id} />
          ) : (
            <input type="hidden" name="course" value={freeTextCourse} />
          )}
          <input type="hidden" name="date" value={new Date().toISOString().slice(0, 10)} />

          <h2 className="font-heading text-xl">{selectedCourse?.name ?? freeTextCourse}</h2>

          {selectedCourse ? (
            <Card>
              <CardContent className="grid grid-cols-3 gap-2 py-4 text-center text-xs">
                {selectedCourse.holes.map((h) => (
                  <div key={h.number} className="rounded-lg bg-secondary/30 p-2">
                    <p className="font-heading text-lg">{h.number}</p>
                    <p className="text-muted-foreground">
                      {t.par} {h.par}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">{t.freeCourseNotice}</p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal">{t.goalLabel}</Label>
            <Input id="goal" name="goal" placeholder={t.goalPlaceholder} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? t.creating : t.create}
          </Button>
        </form>
      )}
    </div>
  );
}

function fmtRecommendation(t: Dictionary["newGame"], count: number): string {
  const recommended = modesForPlayerCount(count)[0];
  return t.recommendationTemplate.replace("{count}", String(count)).replace("{mode}", t.modeLabels[recommended]);
}
