"use client";

import { CoachChat } from "@/components/coach-chat";
import { CallCoach } from "@/components/call-coach";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ChatMessage = { id: string; role: "USER" | "ASSISTANT"; content: string };

/**
 * El compañero fuera de cualquier partida activa (ver /mind) — el chat es
 * ahora el contenido principal de la pantalla, no algo detrás de un botón.
 */
export function MindCompanion({
  initialMessages,
  t,
  quickPrompts,
}: {
  initialMessages: ChatMessage[];
  t: Dictionary["chat"];
  quickPrompts: readonly string[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <CallCoach t={t} />
      <div className="min-h-0 flex-1">
        <CoachChat initialMessages={initialMessages} t={t} quickPrompts={quickPrompts} />
      </div>
    </div>
  );
}
