"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { CoachChat } from "@/components/coach-chat";
import { CallCoach } from "@/components/call-coach";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ChatMessage = { id: string; role: "USER" | "ASSISTANT"; content: string };

/** El compañero fuera de cualquier partida activa (ver /mind). */
export function MindCompanion({
  initialMessages,
  t,
  quickPrompts,
}: {
  initialMessages: ChatMessage[];
  t: Dictionary["chat"];
  quickPrompts: readonly string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" className="w-full gap-2">
        <MessageCircle className="size-5" />
        {t.talkToCoach}
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{t.coachTitle}</DrawerTitle>
            <DrawerDescription>{t.standaloneSubtitle}</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
            <CallCoach t={t} />
            <div className="min-h-0 flex-1">
              <CoachChat initialMessages={initialMessages} t={t} quickPrompts={quickPrompts} />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
