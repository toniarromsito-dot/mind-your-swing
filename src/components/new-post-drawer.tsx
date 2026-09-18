"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { StoryForm } from "@/components/story-form";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function NewPostDrawer({ t }: { t: Dictionary["community"] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.newPost}
        className="fixed right-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <Plus className="size-6" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t.newPost}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto p-4">
            <StoryForm t={t} onPosted={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
