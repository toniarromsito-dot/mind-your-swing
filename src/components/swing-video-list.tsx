"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Play, Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MindMark } from "@/components/mind-mark";
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
};

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
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
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
        <Card key={video.id}>
          <CardContent className="flex flex-col gap-3 pt-6">
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

            <video src={video.videoUrl} controls className="max-h-72 w-full rounded-lg bg-black" />

            {video.note && <p className="text-sm text-muted-foreground italic">&ldquo;{video.note}&rdquo;</p>}

            {video.aiFeedback && (
              <div className="flex flex-col gap-2 rounded-lg bg-secondary/40 p-3">
                <div className="flex items-center gap-2">
                  <MindMark size="sm" />
                  <p className="text-xs font-medium text-muted-foreground">{t.aiFeedbackLabel}</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{video.aiFeedback}</p>
                <div className="flex items-center justify-between">
                  <PlayFeedbackButton text={video.aiFeedback} label={t.playAudio} />
                  <Link
                    href="/aprende"
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {t.practiceLinkLabel}
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            )}

            {video.feedback ? (
              <div className="flex flex-col gap-1.5 rounded-lg bg-primary/10 p-3">
                <p className="text-xs font-medium text-primary">{t.manualFeedbackLabel}</p>
                <p className="text-sm whitespace-pre-wrap">{video.feedback}</p>
                <PlayFeedbackButton text={video.feedback} label={t.playAudio} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t.statusPending}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
