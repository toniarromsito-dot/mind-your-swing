"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Brain, Leaf, Target, Sparkles, Trophy, Mic, ArrowUp, ChevronRight } from "lucide-react";
import { MentalScoreRing } from "@/components/mental-score-ring";
import { TrendArrow } from "@/components/trend-arrow";
import type { MentalScore, MentalState } from "@/lib/mood";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const QUICK_PROMPT_ICONS = [Brain, Leaf, Target, Sparkles, Trophy];

export type CoachTopic = { title: string; body: string; category: string; photo: string };

/**
 * Pantalla de inicio de Coach — antes de la primera conversación. En
 * cuanto el jugador envía algo desde aquí (input, chip o tema), la
 * pantalla cambia al chat real (CoachChat/MindCompanion) con ese mismo
 * mensaje como primer turno: nunca es un botón decorativo que no lleva
 * a ninguna parte.
 */
export function CoachHub({
  greeting,
  photo,
  mentalScore,
  mentalState,
  topics,
  quickPrompts,
  onStart,
  t,
  homeT,
}: {
  /** Ya resuelto en el servidor (t.mind.greeting(firstName)) — una función no se puede pasar a un Client Component. */
  greeting: string;
  photo: string;
  mentalScore: MentalScore | null;
  mentalState: MentalState | null;
  topics: CoachTopic[];
  quickPrompts: readonly string[];
  onStart: (message: string) => void;
  t: Omit<Dictionary["mind"], "greeting">;
  homeT: Dictionary["home"];
}) {
  const [input, setInput] = useState("");

  function submit() {
    if (!input.trim()) return;
    onStart(input);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">{t.tagline}</p>
        </div>
      </div>

      <div className="relative -mx-4 h-64 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:w-full sm:rounded-3xl">
        <Image src={photo} alt="" fill sizes="(min-width: 640px) 600px, 100vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="font-heading text-lg leading-tight text-white italic">
            {t.photoTagline1}
            <br />
            {t.photoTagline2}
            <br />
            {t.photoTagline3}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl bg-secondary/50 p-5">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            {t.aiCoachEyebrow}
          </span>
          <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            {t.onlineStatus}
          </span>
        </div>
        <div>
          <p className="font-heading text-2xl leading-tight font-semibold">{greeting}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t.greetingBody}</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pr-1.5 pl-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.hubInputPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Mic className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>

        <div className="flex flex-col gap-2">
          <p className="text-[10.5px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            {t.quickCoachingTitle}
          </p>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt, i) => {
              const Icon = QUICK_PROMPT_ICONS[i % QUICK_PROMPT_ICONS.length];
              return (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onStart(prompt)}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary/60"
                >
                  <Icon className="size-3.5 text-primary" strokeWidth={1.5} />
                  {prompt}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {t.popularTopicsTitle}
          </h2>
          <Link href="/aprende" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {t.seeAll}
            <ChevronRight className="size-3" />
          </Link>
        </div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {topics.map((topic) => (
            <button
              key={topic.title}
              type="button"
              onClick={() => onStart(topic.body)}
              className="group relative h-40 w-32 shrink-0 overflow-hidden rounded-2xl text-left"
            >
              <Image src={topic.photo} alt="" fill sizes="128px" className="object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="text-sm leading-tight font-semibold text-white">{topic.title}</p>
                <p className="mt-1 text-[9px] font-medium tracking-[0.1em] text-white/70 uppercase">
                  {topic.category}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {mentalScore && mentalState && (
        <div className="flex flex-col gap-4 rounded-3xl border border-border/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t.mentalPerformanceTitle}
            </h2>
            <Link href="/insights" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t.seeDetails}
              <ChevronRight className="size-3" />
            </Link>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative flex size-[84px] shrink-0 items-center justify-center">
              <MentalScoreRing score={mentalScore.score} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-2xl leading-none font-semibold">{mentalScore.score}</span>
                <span className="text-[9px] text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary">
                {homeT[`state${capitalize(mentalState)}` as const]}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {homeT[`stateBody${capitalize(mentalState)}` as const]}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 border-l border-border/60 pl-4 text-xs text-muted-foreground">
              <span className="flex items-center justify-between gap-3">
                {homeT.confidenceLabel} <TrendArrow trend={mentalScore.confidence} />
              </span>
              <span className="flex items-center justify-between gap-3">
                {homeT.focusLabel} <TrendArrow trend={mentalScore.focus} />
              </span>
              <span className="flex items-center justify-between gap-3">
                {homeT.pressureLabel} <TrendArrow trend={mentalScore.pressure} />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}
