import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listFollowingIds } from "@/lib/data/social";
import { FollowButton } from "@/components/follow-button";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const userId = await requireUserId();
  const { t } = await getDictionary();
  const { q } = await searchParams;
  const query = q?.trim();

  const [followingIds, players] = await Promise.all([
    listFollowingIds(userId),
    prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
      },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true, image: true, club: true },
    }),
  ]);
  const followingSet = new Set(followingIds);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <Link href="/perfil" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
          {t.perfil.backToProfile}
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t.community.friendsTitle}</h1>
      </div>

      <form method="GET" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          name="q"
          defaultValue={query ?? ""}
          placeholder={t.community.searchPlaceholder}
          className="w-full rounded-full border border-border bg-card py-2.5 pr-4 pl-10 text-sm outline-none focus:border-primary"
        />
      </form>

      <div className="flex flex-col gap-2">
        {players.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.community.noPlayersFound}</p>
        ) : (
          players.map((player) => (
            <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              {player.image ? (
                <Image src={player.image} alt={player.name ?? ""} width={40} height={40} className="rounded-full" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm text-secondary-foreground">
                  {player.name?.[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{player.name}</p>
                {player.club && <p className="truncate text-xs text-muted-foreground">{player.club}</p>}
              </div>
              <FollowButton targetUserId={player.id} initiallyFollowing={followingSet.has(player.id)} t={t.community} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
