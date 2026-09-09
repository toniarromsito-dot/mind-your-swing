import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listDemoCourses } from "@/lib/data/games";
import { GameWizard } from "@/components/game-wizard";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function NewGamePage() {
  const userId = await requireUserId();
  const [user, courses] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } }),
    listDemoCourses(),
  ]);
  const { t } = await getDictionary();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-heading text-2xl">{t.newGame.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.newGame.subtitle}</p>
      <div className="mt-6">
        <GameWizard courses={courses} t={t.newGame} isPro={user.plan === "PRO"} />
      </div>
    </div>
  );
}
