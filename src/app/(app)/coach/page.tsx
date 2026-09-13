import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getStandaloneMessages } from "@/lib/data/games";
import { MindSettingsDrawer } from "@/components/mind-settings-drawer";
import { MindCompanion } from "@/components/mind-companion";
import { MindMark } from "@/components/mind-mark";
import { moodTrend } from "@/lib/mood";
import { getDictionary } from "@/lib/i18n/current-locale";

/**
 * El chat es el contenido principal de esta pantalla — no una pila de
 * tarjetas con un botón que abre el chat en un cajón. Personalidad y
 * estado de ánimo viven en MindSettingsDrawer, detrás de un icono
 * pequeño en la cabecera.
 */
export default async function MindPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const [user, messages, recentMoods] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    getStandaloneMessages(userId),
    prisma.moodEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const trend = moodTrend([...recentMoods].reverse(), {
    hole: t.summary.chartHole,
    checkin: t.summary.chartCheckin,
  });

  return (
    // Altura exacta del hueco libre dentro de <main>: header (4rem) + su
    // padding superior (1.5rem) + el hueco reservado para la bottom nav
    // (6rem) + safe areas — si no se descuenta todo, el chat crece de más
    // y empuja el campo de texto fuera de la pantalla en vez de scrollear
    // solo internamente.
    <div className="mx-auto flex h-[calc(100dvh-11.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-lg flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MindMark size="lg" />
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.mind.title}</h1>
            <p className="text-sm text-muted-foreground">{t.mind.subtitle}</p>
          </div>
        </div>
        <MindSettingsDrawer
          coachTone={user.coachTone}
          moodTrendData={trend}
          noMoodDataLabel={t.summary.noMoodData}
          t={t.mind}
          moodCheckinT={t.moodCheckin}
          moodLabels={t.mood}
        />
      </div>

      <MindCompanion
        initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        t={t.chat}
        quickPrompts={t.quickPrompts}
      />
    </div>
  );
}
