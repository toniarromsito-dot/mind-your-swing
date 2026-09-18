"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { joinChallenge } from "@/actions/social";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ChallengeCard({
  challengeId,
  title,
  description,
  joinedCount,
  targetParticipants,
  initiallyJoined,
  t,
}: {
  challengeId: string;
  title: string;
  description: string;
  joinedCount: number;
  targetParticipants: number;
  initiallyJoined: boolean;
  t: Dictionary["community"];
}) {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(initiallyJoined);
  const [count, setCount] = useState(joinedCount);
  const [isPending, startTransition] = useTransition();

  const progress = Math.min(100, Math.round((count / targetParticipants) * 100));

  function join() {
    startTransition(async () => {
      try {
        await joinChallenge(challengeId);
        setJoined(true);
        setCount((c) => c + 1);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.challengeJoinError);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-3xl bg-card p-3 text-left shadow-sm"
      >
        <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl">
          <Image src={DASHBOARD_PHOTOS.community} alt="" fill sizes="56px" className="object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-semibold">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {fmt(t.challengeParticipants, { joined: count, target: targetParticipants })}
            </span>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 p-4">
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">
                {fmt(t.challengeParticipants, { joined: count, target: targetParticipants })}
              </span>
            </div>
          </div>
          <DrawerFooter>
            <Button type="button" disabled={joined || isPending} onClick={join}>
              {joined ? t.challengeJoined : t.challengeJoin}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
