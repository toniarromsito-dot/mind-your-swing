"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Play, Loader2, ArrowRight } from "lucide-react";
import { MindMark } from "@/components/mind-mark";
import { cn } from "@/lib/utils";
import type { SwingMetrics } from "@/lib/swing/scoring";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type SwingVideoItem = {
  id: string;
  videoUrl: string;
  note: string | null;
  score: number | null;
  aiFeedback: string | null;
  feedback: string | null;
  status: "PENDING" | "REVIEWED";
  createdAt: string;
  /** JSON tal cual sale de Prisma — se valida su forma antes de leerla, nunca se asume. */
  metrics: unknown;
};

/** Comprobación mínima de forma antes de confiar en el JSON guardado — nunca se asume que coincide con el tipo actual. */
function isSwingMetrics(value: unknown): value is SwingMetrics {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.hipRotation === "object" &&
    typeof v.tempo === "object" &&
    typeof v.weightTransfer === "object" &&
    (v.phases === null || Array.isArray(v.phases))
  );
}

/**
 * Línea de tiempo real del swing: el análisis solo detecta con fiabilidad
 * 3 tramos + los 2 instantes que los separan (ver scoring.ts) — Setup y
 * Finish se etiquetan como los puntos de inicio/fin real del vídeo (no
 * segmentos medidos aparte), y cada tramo intermedio lleva las dos
 * etiquetas profesionales que cubre (p. ej. "Takeaway · Backswing")
 * en vez de inventar un límite exacto entre ellas que no medimos. Cada
 * segmento tiene un ancho proporcional a su duración real y muestra la
 * métrica ya calculada más relacionada.
 */
function SwingPhaseTimeline({ metrics, t }: { metrics: SwingMetrics; t: Dictionary["swingVideos"] }) {
  if (!metrics.phases) return null;
  const totalMs = metrics.phases[metrics.phases.length - 1].endMs - metrics.phases[0].startMs;
  if (totalMs <= 0) return null;

  const segments = [
    {
      phase: metrics.phases[0],
      label: t.phaseBackswing,
      metricLabel: t.phaseHipRotation,
      metricValue: `${metrics.hipRotation.score}/100`,
    },
    {
      phase: metrics.phases[1],
      label: t.phaseDownswing,
      metricLabel: t.phaseTempo,
      metricValue: metrics.tempo.ratio != null ? `${metrics.tempo.ratio}:1` : "—",
    },
    {
      phase: metrics.phases[2],
      label: t.phaseFollowThrough,
      metricLabel: t.phaseWeightTransfer,
      metricValue: `${metrics.weightTransfer.score}/100`,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">{t.phasesTitle}</p>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">{t.phaseSetup}</span>
        <div className="flex h-2 flex-1 gap-0.5 overflow-hidden rounded-full">
          {segments.map((s, i) => (
            <div
              key={s.label}
              className={cn("h-full", i === 0 ? "bg-primary/40" : i === 1 ? "bg-primary/70" : "bg-primary")}
              style={{ width: `${((s.phase.endMs - s.phase.startMs) / totalMs) * 100}%` }}
            />
          ))}
        </div>
        <span className="text-[10px] font-medium text-muted-foreground uppercase">{t.phaseFinish}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {segments.map((s) => (
          <div key={s.label} className="flex flex-col">
            <span className="text-[11px] font-medium">{s.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {s.metricLabel} {s.metricValue}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : score >= 50
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-destructive/15 text-destructive";
  return (
    <div className={`flex size-14 shrink-0 flex-col items-center justify-center rounded-full ${color}`}>
      <span className="font-heading text-lg leading-none">{score}</span>
      <span className="text-[10px] leading-none">/100</span>
    </div>
  );
}

function PlayFeedbackButton({ text, label }: { text: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function play() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play().catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={play}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-muted-foreground active:text-foreground disabled:opacity-50"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
      {label}
    </button>
  );
}

export function SwingVideoList({ videos, t, dateLocale }: { videos: SwingVideoItem[]; t: Dictionary["swingVideos"]; dateLocale: string }) {
  if (videos.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {videos.map((video) => (
        <div key={video.id} className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {new Date(video.createdAt).toLocaleDateString(dateLocale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            {video.score != null && <ScoreBadge score={video.score} />}
          </div>

          <video src={video.videoUrl} controls className="max-h-72 w-full rounded-2xl bg-black" />

          {isSwingMetrics(video.metrics) && <SwingPhaseTimeline metrics={video.metrics} t={t} />}

          {video.note && <p className="text-sm text-muted-foreground italic">&ldquo;{video.note}&rdquo;</p>}

          {video.aiFeedback && (
            <div className="flex flex-col gap-2 rounded-2xl bg-secondary/40 p-4">
              <div className="flex items-center gap-2">
                <MindMark size="sm" />
                <p className="text-xs font-medium text-muted-foreground">{t.aiFeedbackLabel}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap">{video.aiFeedback}</p>
              <div className="flex items-center justify-between">
                <PlayFeedbackButton text={video.aiFeedback} label={t.playAudio} />
                <Link
                  href="/aprende"
                  className="flex items-center gap-1 text-xs font-medium text-primary active:underline"
                >
                  {t.practiceLinkLabel}
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          )}

          {video.feedback ? (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-primary/10 p-4">
              <p className="text-xs font-medium text-primary">{t.manualFeedbackLabel}</p>
              <p className="text-sm whitespace-pre-wrap">{video.feedback}</p>
              <PlayFeedbackButton text={video.feedback} label={t.playAudio} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t.statusPending}</p>
          )}
        </div>
      ))}
    </div>
  );
}
