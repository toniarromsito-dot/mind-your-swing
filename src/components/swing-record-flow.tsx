"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwingVideoUploader } from "@/components/swing-video-uploader";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Antes de mostrar el selector de vídeo, una pantalla de instrucciones muy
 * simple ("coloca el móvil de lado") — nunca detalles técnicos de cómo se
 * analiza el vídeo por detrás.
 */
export function SwingRecordFlow({ t }: { t: Dictionary["swingVideos"] }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  if (!ready) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Camera className="size-5" />
        </span>
        <div>
          <p className="font-heading text-lg">{t.prepTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.prepInstruction}</p>
        </div>
        <Button size="lg" className="mt-1 w-full rounded-full sm:w-auto sm:px-8" onClick={() => setReady(true)}>
          {t.prepContinue}
        </Button>
      </div>
    );
  }

  return <SwingVideoUploader t={t} onSaved={() => router.refresh()} />;
}
