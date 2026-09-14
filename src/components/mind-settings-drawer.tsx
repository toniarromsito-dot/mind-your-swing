"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { CoachTone } from "@prisma/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonalityPicker } from "@/components/personality-picker";
import { MoodCheckin } from "@/components/mood-checkin";
import { MoodChart } from "@/components/mood-chart";
import type { MoodPoint } from "@/lib/mood";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Personalidad y estado de ánimo ya no están siempre visibles en /mind —
 * el chat es el contenido principal (brief: "no quiero que parezca ChatGPT
 * pero de golf"). Esto vive detrás de un icono pequeño en la cabecera.
 */
export function MindSettingsDrawer({
  coachTone,
  moodTrendData,
  noMoodDataLabel,
  t,
  moodCheckinT,
  moodLabels,
}: {
  coachTone: CoachTone;
  moodTrendData: MoodPoint[];
  noMoodDataLabel: string;
  /** Sin `greeting`: es una función y no se puede pasar a un Client Component. */
  t: Omit<Dictionary["mind"], "greeting">;
  moodCheckinT: Dictionary["moodCheckin"];
  moodLabels: Dictionary["mood"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.settingsLabel}
        className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <SlidersHorizontal className="size-4" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader>
            <DrawerTitle>{t.settingsLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
            <div>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t.personalityTitle}</h2>
              <PersonalityPicker defaultValue={coachTone} t={t} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">{t.checkinTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <MoodCheckin t={moodCheckinT} moodLabels={moodLabels} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.moodHistoryTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <MoodChart data={moodTrendData} emptyLabel={noMoodDataLabel} />
              </CardContent>
            </Card>

            <p className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
              {t.disclaimer}
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
