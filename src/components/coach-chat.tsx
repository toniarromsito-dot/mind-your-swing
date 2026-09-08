"use client";

import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw, Loader2, Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const VOICE_PREF_KEY = "mys-voice-enabled";

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  pending?: boolean;
  failed?: boolean;
  audioUrl?: string;
};

export function CoachChat({
  roundId,
  holeId,
  initialMessages,
  t,
  quickPrompts,
}: {
  roundId: string;
  holeId?: string | null;
  initialMessages: { id: string; role: "USER" | "ASSISTANT"; content: string }[];
  t: Dictionary["chat"];
  quickPrompts: readonly string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VOICE_PREF_KEY);
      if (stored !== null) setVoiceEnabled(stored === "true");
    } catch {
      // localStorage no disponible (modo privado, etc.): se queda en el valor por defecto
    }
  }, []);

  function toggleVoice() {
    setVoiceEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VOICE_PREF_KEY, String(next));
      } catch {
        // no pasa nada si no se puede persistir
      }
      return next;
    });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function playMessageAudio(id: string, text: string) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return; // la voz es un extra: si falla, el chat de texto sigue funcionando

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, audioUrl: url } : m)));

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play().catch(() => {
        // autoplay bloqueado por el navegador: el usuario puede darle al botón "Escuchar"
      });
    } catch {
      // best-effort: nunca romper el chat por un fallo de voz
    }
  }

  async function send(content: string) {
    if (!content.trim() || sending) return;
    setInput("");
    setSending(true);
    setLastFailedContent(null);

    const userMsgId = `local-${Date.now()}`;
    const assistantMsgId = `local-${Date.now()}-a`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "USER", content },
      { id: assistantMsgId, role: "ASSISTANT", content: "", pending: true },
    ]);

    let assistantText = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId, holeId: holeId ?? undefined, content }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? t.connectionError);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawError: string | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "token"; text: string }
            | { type: "done" }
            | { type: "error"; message: string };

          if (event.type === "token") {
            assistantText += event.text;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: m.content + event.text, pending: false } : m
              )
            );
          } else if (event.type === "error") {
            sawError = event.message;
          }
        }
      }

      if (sawError) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId && m.content.length === 0
              ? { ...m, content: sawError!, pending: false, failed: true }
              : m
          )
        );
      } else if (voiceEnabled && assistantText.trim()) {
        void playMessageAudio(assistantMsgId, assistantText);
      }
    } catch (err) {
      setLastFailedContent(content);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: err instanceof Error ? err.message : t.genericError,
                pending: false,
                failed: true,
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={toggleVoice}
          title={voiceEnabled ? t.voiceOn : t.voiceOff}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/60"
        >
          {voiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t.emptyState}</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.role === "USER" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                m.role === "USER"
                  ? "bg-primary text-primary-foreground"
                  : m.failed
                    ? "bg-destructive/10 text-destructive"
                    : "bg-secondary text-secondary-foreground"
              )}
            >
              {m.pending && m.content.length === 0 ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {m.content}
                  {m.role === "ASSISTANT" && m.audioUrl && (
                    <button
                      type="button"
                      onClick={() => new Audio(m.audioUrl).play().catch(() => {})}
                      className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Play className="size-3" />
                      {t.playAudio}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {lastFailedContent && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-1 gap-2 self-start text-muted-foreground"
          onClick={() => send(lastFailedContent)}
        >
          <RotateCcw className="size-3.5" />
          {t.retry}
        </Button>
      )}

      <div className="flex flex-wrap gap-2 py-2">
        {quickPrompts.map((p) => (
          <button
            key={p}
            type="button"
            disabled={sending}
            onClick={() => send(p)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border pt-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={t.inputPlaceholder}
          rows={1}
          className="min-h-10 flex-1 resize-none"
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
