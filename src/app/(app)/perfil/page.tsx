import Image from "next/image";
import Link from "next/link";
import { ChevronRight, History, Settings, Trophy, Users } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listGamesForUser } from "@/lib/data/games";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
import { computeMentalScore } from "@/lib/mood";
import { getDictionary } from "@/lib/i18n/current-locale";

/**
 * Perfil = la identidad del golfista (se ve), separado de /settings
 * (se configura). Estadísticas y navegación a Historial/Torneos/Amigos,
 * todo con datos ya calculados en otras fases — nada nuevo fabricado.
 */
export default async function ProfilePage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const [user, games, recentMoods] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    listGamesForUser(userId),
    prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 14,
      select: { mood: true },
    }),
  ]);

  const completedGames = games.filter((g) => g.status === "COMPLETED");
  const mentalScore = computeMentalScore(recentMoods);

  let bestRoundGross: number | null = null;
  let bestRoundCourse: string | null = null;
  for (const game of completedGames) {
    const { players, scores } = toStandingsInput(game);
    const myPlayer = game.players.find((p) => p.user.id === userId);
    if (!myPlayer) continue;
    const standing = computeStrokeStandings(players, scores).find((s) => s.playerId === myPlayer.id);
    if (standing && (bestRoundGross == null || standing.total < bestRoundGross)) {
      bestRoundGross = standing.total;
      bestRoundCourse = game.course;
    }
  }

  const navItems = [
    { href: "/play", icon: History, label: t.perfil.navHistory },
    { href: "/community/tournaments", icon: Trophy, label: t.perfil.navTournaments },
    { href: "/community/friends", icon: Users, label: t.perfil.navFriends },
  ];

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          {user.image ? (
            <Image src={user.image} alt={user.name ?? ""} width={88} height={88} className="rounded-full" />
          ) : (
            <div className="flex size-[88px] items-center justify-center rounded-full bg-secondary text-2xl text-secondary-foreground">
              {user.name?.[0] ?? "?"}
            </div>
          )}
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{user.name}</h1>
            {user.club && <p className="text-sm text-muted-foreground">{user.club}</p>}
          </div>
        </div>
        <Link
          href="/settings"
          aria-label={t.perfil.settingsLabel}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground/70"
        >
          <Settings className="size-4" strokeWidth={1.5} />
        </Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border/70 py-4">
        <div className="flex flex-col items-center gap-0.5">
          <p className="font-heading text-2xl font-semibold">{completedGames.length}</p>
          <p className="text-xs text-muted-foreground uppercase">{t.perfil.roundsLabel}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="font-heading text-2xl font-semibold">{mentalScore?.score ?? "—"}</p>
          <p className="text-xs text-muted-foreground uppercase">{t.perfil.mentalLabel}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="font-heading text-2xl font-semibold">{user.handicap ?? "—"}</p>
          <p className="text-xs text-muted-foreground uppercase">{t.perfil.handicapShortLabel}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
          {t.perfil.achievementsTitle}
        </h2>
        {bestRoundGross != null ? (
          <div className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t.perfil.bestRoundLabel}</p>
              <p className="text-xs text-muted-foreground">{bestRoundCourse}</p>
            </div>
            <p className="font-heading text-2xl font-semibold">{bestRoundGross}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.perfil.noBestRound}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-secondary/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <item.icon className="size-4" />
            </span>
            <span className="flex-1 text-sm font-medium">{item.label}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
