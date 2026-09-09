import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getStandaloneMessages } from "@/lib/data/games";
import { PersonalityPicker } from "@/components/personality-picker";
import { MoodCheckin } from "@/components/mood-checkin";
import { MoodChart } from "@/components/mood-chart";
import { MindCompanion } from "@/components/mind-companion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { moodTrend } from "@/lib/mood";
import { getDictionary } from "@/lib/i18n/current-locale";

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
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">{t.mind.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.mind.subtitle}</p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t.mind.personalityTitle}</h2>
        <PersonalityPicker defaultValue={user.coachTone} t={t.mind} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t.mind.checkinTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <MoodCheckin t={t.moodCheckin} moodLabels={t.mood} />
        </CardContent>
      </Card>

      <MindCompanion
        initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
        t={t.chat}
        quickPrompts={t.quickPrompts}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.mind.moodHistoryTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <MoodChart data={trend} emptyLabel={t.summary.noMoodData} />
        </CardContent>
      </Card>

      <p className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        {t.mind.disclaimer}
      </p>
    </div>
  );
}
