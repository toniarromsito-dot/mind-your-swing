"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { fmt } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

export type ExerciseStep = { title: string; body?: string; breathing?: boolean };

/**
 * Motor genérico de "herramienta corta a pantalla completa": Rutina
 * pre-golpe, Reset mental, Visualización y Respiración comparten esta
 * misma mecánica (pasos → paso final → salir), solo cambia el contenido.
 * Extraído de lo que antes era código propio de PreShotRoutine para no
 * triplicar la misma navegación fullscreen en cada ejercicio nuevo.
 */
export function GuidedExercise({
  steps,
  finalTitle,
  finalBody,
  exitLabel,
  stepLabel,
  ctaLabel,
  breatheInhale,
  breatheExhale,
  exitHref,
}: {
  steps: ExerciseStep[];
  finalTitle: string;
  finalBody: string;
  exitLabel: string;
  stepLabel: string;
  ctaLabel: string;
  breatheInhale: string;
  breatheExhale: string;
  exitHref: string;
}) {
  const [step, setStep] = useState(0);
  const isFinal = step === steps.length;

  function next() {
    setStep((s) => Math.min(s + 1, steps.length));
  }
  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-primary pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-primary-foreground">
      <div className="flex items-center justify-between px-4">
        <Link
          href={exitHref}
          aria-label={exitLabel}
          className="flex size-8 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
        >
          <X className="size-4" />
        </Link>
        {!isFinal && (
          <span className="text-xs text-primary-foreground/60">{fmt(stepLabel, { n: step + 1, total: steps.length })}</span>
        )}
        <span className="size-8" />
      </div>

      <div
        key={step}
        className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center duration-300 animate-in fade-in"
      >
        {isFinal ? (
          <>
            <p className="font-heading text-3xl font-semibold">{finalTitle}</p>
            <p className="text-sm text-primary-foreground/75">{finalBody}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium tracking-[0.3em] text-primary-foreground/50">
              {String(step + 1).padStart(2, "0")}
            </p>
            <p className="font-heading text-3xl font-semibold">{steps[step].title}</p>
            {steps[step].breathing ? (
              <BreathingCircle inhale={breatheInhale} exhale={breatheExhale} />
            ) : (
              steps[step].body && <p className="max-w-xs text-sm text-primary-foreground/75">{steps[step].body}</p>
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
            href={exitHref}
            className="flex flex-1 items-center justify-center rounded-full bg-white py-3 text-sm font-medium text-primary"
          >
            {ctaLabel}
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

export function BreathingCircle({ inhale, exhale }: { inhale: string; exhale: string }) {
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
