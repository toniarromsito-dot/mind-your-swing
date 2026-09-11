import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listDemoCourses } from "@/lib/data/games";
import { GameWizard } from "@/components/game-wizard";
import { getDictionary } from "@/lib/i18n/current-locale";
import { hasProAccess } from "@/lib/plan";

export default async function NewGamePage() {
  const userId = await requireUserId();
  const [user, courses] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, email: true } }),
    listDemoCourses(),
  ]);
  const { t } = await getDictionary();

  return <GameWizard courses={courses} t={t.newGame} isPro={hasProAccess(user)} />;
}
