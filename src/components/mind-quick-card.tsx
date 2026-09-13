"use client";

import { useState } from "react";
import Link from "next/link";
import { MindMark } from "@/components/mind-mark";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { getQuickCoachCard } from "@/actions/coach";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Acceso a Mind durante Focus Mode: en vez de navegar directamente al
 * chat completo, se abre esta tarjeta corta (una respuesta de 2-4 frases,
 * ver PHASE_GUIDANCE.durante_partida en coach/prompt.ts) — el chat
 * completo sigue existiendo en /mind como opción secundaria, un toque
 * más lejos ("Hablar con mi coach").
 */
export function MindQuickCard({
  gameId,
  holeId,
  t,
}: {
  gameId: string;
  holeId: string;
  t: Dictionary["playGame"]["quickCoach"];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);

  function ask(prompt: string) {
    setLoading(true);
    setText(null);
    getQuickCoachCard(gameId, holeId, prompt).then((res) => {
      setLoading(false);
      setText("error" in res ? res.error : res.text);
    });
  }

  function openCard() {
    setOpen(true);
    ask(t.initialPrompt);
  }

  return (
    <>
      <button type="button" onClick={openCard} aria-label="Mind" className="transition-opacity hover:opacity-80">
        <MindMark size="sm" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Mind</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col items-center gap-5 px-6 pb-8 text-center">
            <MindMark size="lg" thinking={loading} />
            {!loading && text && <p className="text-base whitespace-pre-wrap">{text}</p>}

            <div className="flex flex-wrap justify-center gap-2">
              {t.chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => ask(chip)}
                  disabled={loading}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>

            <Link href="/coach" className="text-sm text-muted-foreground underline underline-offset-4">
              {t.talkToCoach}
            </Link>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
