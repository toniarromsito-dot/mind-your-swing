"use client";

import { useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function CallCoach(props: { gameId?: string | null; holeId?: string | null; t: Dictionary["chat"] }) {
  return (
    <ConversationProvider>
      <CallCoachInner {...props} />
    </ConversationProvider>
  );
}

function logCallDuration(startedAt: number | null) {
  if (startedAt == null) return;
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  if (durationSeconds <= 0) return;
  fetch("/api/voice/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSeconds }),
    keepalive: true,
  }).catch(() => {
    // best-effort: si falla, en el peor caso ese tramo no cuenta para el límite mensual
  });
}

function CallCoachInner({
  gameId,
  holeId,
  t,
}: {
  gameId?: string | null;
  holeId?: string | null;
  t: Dictionary["chat"];
}) {
  const [connecting, setConnecting] = useState(false);
  const callStartRef = useRef<number | null>(null);

  const conversation = useConversation({
    onError: () => toast.error(t.callError),
    onDisconnect: () => {
      logCallDuration(callStartRef.current);
      callStartRef.current = null;
    },
  });

  const inCall = conversation.status === "connected";

  async function startCall() {
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error(t.micDenied);
      setConnecting(false);
      return;
    }

    try {
      const res = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: gameId ?? undefined, holeId: holeId ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.code === "VOICE_LIMIT_REACHED") {
          throw new Error(t.callLimitReached);
        }
        throw new Error(data?.error ?? t.callUnavailable);
      }
      const { signedUrl, dynamicVariables } = await res.json();
      await conversation.startSession({ signedUrl, dynamicVariables });
      callStartRef.current = Date.now();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.callError);
    } finally {
      setConnecting(false);
    }
  }

  async function endCall() {
    await conversation.endSession();
  }

  if (inCall) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-secondary/40 p-5">
        <div
          className={cn(
            "flex size-16 items-center justify-center rounded-full transition-colors",
            conversation.isSpeaking ? "bg-primary animate-pulse" : "bg-primary/60"
          )}
        >
          <Phone className="size-7 text-primary-foreground" />
        </div>
        <p className="text-sm font-medium">
          {conversation.isSpeaking ? t.speaking : t.listening}
        </p>
        <button
          type="button"
          onClick={endCall}
          className="flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
        >
          <PhoneOff className="size-4" />
          {t.hangUp}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startCall}
      disabled={connecting}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-secondary/30 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary/50 disabled:opacity-60"
    >
      {connecting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {t.connecting}
        </>
      ) : (
        <>
          <Phone className="size-4" />
          {t.call}
        </>
      )}
    </button>
  );
}
