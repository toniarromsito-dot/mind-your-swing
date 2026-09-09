"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { AlertCircle, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { submitSwingVideo } from "@/actions/swing-videos";
import { PoseExtractionError, extractPoseFramesFromVideo } from "@/lib/swing/pose-landmarker";
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
        <Label htmlFor="swing-video-file">{t.chooseFile}</Label>
        <input
          ref={fileInputRef}
          id="swing-video-file"
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">{fileName ?? t.noFileChosen}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="swing-video-note">{t.notePlaceholder}</Label>
        <Textarea ref={noteRef} id="swing-video-note" rows={2} disabled={busy} />
      </div>

      {busy && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary/40 p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {step === "uploading" && t.stepUploading}
            {step === "analyzing" && t.stepAnalyzing}
            {step === "feedback" && t.stepFeedback}
          </div>
          {step === "analyzing" && <Progress value={progress} />}
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
