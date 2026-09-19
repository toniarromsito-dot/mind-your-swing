import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listRealGolfCourses } from "@/lib/data/games";
import { NewGameScreen } from "@/components/new-game-screen";
import { getDictionary } from "@/lib/i18n/current-locale";
import { hasProAccess } from "@/lib/plan";

export default async function NewGamePage() {
  const userId = await requireUserId();
  const [user, courses] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true, email: true, name: true, image: true, handicap: true },
    }),
    listRealGolfCourses(),
  ]);
  const { t } = await getDictionary();

  return (
    <NewGameScreen
      courses={courses}
      t={t.newGame}
      playT={t.play}
      isPro={hasProAccess(user)}
      me={{ name: user.name, image: user.image, handicap: user.handicap }}
    />
  );
}
