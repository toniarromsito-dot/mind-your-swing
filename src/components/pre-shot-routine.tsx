"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Herramienta independiente, NUNCA insertada a la fuerza en el flujo de
 * puntuación de Focus Mode — el "toca el número y listo" sigue intacto
 * para quien no abra esto. Target → Breathe → Commit → Swing → Accept,
 * ~10-15s en total.
 */
export function PreShotRoutine({ t }: { t: Dictionary["preShotRoutine"] }) {
  const [step, setStep] = useState(0);
  const isFinal = step === t.steps.length;
  const isBreathe = step === 1;

  function next() {
    setStep((s) => Math.min(s + 1, t.steps.length));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-primary pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-primary-foreground">
      <div className="flex items-center justify-between px-4">
        <Link
          href="/coach"
          aria-label={t.exitLabel}
          className="flex size-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X className="size-4" />
        </Link>
        {!isFinal && (
          <span className="text-xs text-primary-foreground/60">{fmt(t.stepLabel, { n: step + 1, total: t.steps.length })}</span>
        )}
        <span className="size-8" />
      </div>

      <div
        key={step}
        className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center duration-300 animate-in fade-in"
      >
        {isFinal ? (
          <>
            <p className="font-heading text-3xl font-semibold">{t.finalTitle}</p>
            <p className="text-sm text-primary-foreground/75">{t.finalBody}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium tracking-[0.3em] text-primary-foreground/50">
              {String(step + 1).padStart(2, "0")}
            </p>
            <p className="font-heading text-3xl font-semibold">{t.steps[step].title}</p>
            {isBreathe ? (
              <BreathingCircle inhale={t.breatheInhale} exhale={t.breatheExhale} />
            ) : (
              <p className="max-w-xs text-sm text-primary-foreground/75">{t.steps[step].body}</p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-8">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          className="flex size-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-0"
        >
          <ChevronLeft className="size-5" />
        </button>

        {isFinal ? (
          <Link
            href="/coach"
            className="flex flex-1 items-center justify-center rounded-full bg-white py-3 text-sm font-medium text-primary"
          >
            {t.playShot}
          </Link>
        ) : (
          <button
            type="button"
            onClick={next}
            className="flex size-11 items-center justify-center rounded-full bg-white text-primary transition-transform hover:scale-105"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function BreathingCircle({ inhale, exhale }: { inhale: string; exhale: string }) {
  const [phase, setPhase] = useState<"inhale" | "exhale">("inhale");

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p === "inhale" ? "exhale" : "inhale")), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex size-36 items-center justify-center">
        <span
          className={cn(
            "absolute inset-0 rounded-full border border-white/40 transition-transform duration-[4000ms] ease-in-out",
            phase === "inhale" ? "scale-100" : "scale-[0.55]"
          )}
        />
        <span
          className={cn(
            "absolute inset-0 rounded-full bg-white/10 transition-transform duration-[4000ms] ease-in-out",
            phase === "inhale" ? "scale-90" : "scale-[0.5]"
          )}
        />
        <span className="size-2.5 rounded-full bg-white" />
      </div>
      <p className="text-sm text-primary-foreground/75">{phase === "inhale" ? inhale : exhale}</p>
    </div>
  );
}
