"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { AlertCircle, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { MindMark } from "@/components/mind-mark";
import { submitSwingVideo } from "@/actions/swing-videos";
import { PoseExtractionError, extractPoseFramesFromVideo } from "@/lib/swing/pose-landmarker";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Step = "idle" | "uploading" | "analyzing" | "feedback" | "error";

export function SwingVideoUploader({
  t,
  onSaved,
}: {
  t: Dictionary["swingVideos"];
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const busy = step === "uploading" || step === "analyzing" || step === "feedback";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || busy) return;

    setError(null);
    setProgress(0);

    try {
      setStep("uploading");
      const blob = await upload(`swings/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/swing-videos/upload",
      });

      setStep("analyzing");
      const poseFrames = await extractPoseFramesFromVideo(file, ({ processed, total }) => {
        setProgress(Math.round((processed / total) * 100));
      });

      setStep("feedback");
      const result = await submitSwingVideo({
        videoUrl: blob.url,
        note: noteRef.current?.value,
        poseFrames,
      });

      if ("error" in result) {
        setError(result.error);
        setStep("error");
        return;
      }

      setStep("idle");
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (noteRef.current) noteRef.current.value = "";
      onSaved();
    } catch (err) {
      setError(err instanceof PoseExtractionError ? err.message : t.genericError);
      setStep("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          id="swing-video-file"
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className={cn(
            "flex flex-col items-center gap-2 rounded-3xl border border-dashed px-4 py-8 text-center transition-colors active:bg-secondary/50 disabled:opacity-50",
            fileName ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30"
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="size-5" strokeWidth={1.6} />
          </span>
          <span className="max-w-full truncate px-2 text-sm font-medium">{fileName ?? t.chooseFile}</span>
          <span className="text-xs text-muted-foreground">{fileName ? t.chooseFile : t.noFileChosen}</span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="swing-video-note">{t.notePlaceholder}</Label>
        <Textarea ref={noteRef} id="swing-video-note" rows={2} disabled={busy} />
      </div>

      {busy && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-secondary/40 p-6 text-center">
          <MindMark size="lg" thinking />
          <p className="text-sm font-medium">
            {step === "uploading" && t.stepUploading}
            {step === "analyzing" && t.stepAnalyzing}
            {step === "feedback" && t.stepFeedback}
          </p>
          {step === "analyzing" && <Progress value={progress} className="w-full" />}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" disabled={busy || !fileName} className="gap-2 self-start">
        <UploadCloud className="size-4" />
        {t.submit}
      </Button>
    </form>
  );
}
