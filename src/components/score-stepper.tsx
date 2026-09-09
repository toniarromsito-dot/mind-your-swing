"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selector de golpes en botones grandes en vez de un campo numérico — el
 * brief pide explícitamente que la introducción de resultado funcione
 * bien para golfistas mayores: nada de teclear un número pequeño.
 */
export function ScoreStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 15,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value == null ? min : Math.max(min, value - 1))}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary active:scale-95"
          aria-label={`Restar a ${label}`}
        >
          <Minus className="size-5" />
        </button>
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl font-heading text-2xl tabular-nums",
            value != null ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          )}
        >
          {value ?? "–"}
        </span>
        <button
          type="button"
          onClick={() => onChange(value == null ? min : Math.min(max, value + 1))}
          className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary active:scale-95"
          aria-label={`Sumar a ${label}`}
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  );
}
