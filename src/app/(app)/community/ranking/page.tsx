import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listRankedPlayers, type RankedPlayer } from "@/lib/data/rankings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function RankingRow({ player, position, t }: { player: RankedPlayer; position: number; t: Dictionary["rankings"] }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">{position}</span>
      {player.image ? (
        <Image src={player.image} alt={player.name ?? ""} width={40} height={40} className="rounded-full" />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm text-secondary-foreground">
          {player.name?.[0] ?? "?"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{player.name}</p>
        {player.club && <p className="truncate text-xs text-muted-foreground">{player.club}</p>}
        <p className="truncate text-xs text-muted-foreground/70">
          {fmt(t.roundsLabel, { n: player.roundsCompleted })}
          {player.mentalScore != null && ` · ${fmt(t.mentalLabel, { score: player.mentalScore })}`}
        </p>
      </div>
      <span className="shrink-0 font-heading text-lg font-semibold">{player.handicap}</span>
    </div>
  );
}

export default async function RankingPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const [friends, club, global, me] = await Promise.all([
    listRankedPlayers("friends", userId),
    listRankedPlayers("club", userId),
    listRankedPlayers("global", userId),
    prisma.user.findUnique({ where: { id: userId }, select: { club: true } }),
  ]);
  const hasClub = Boolean(me?.club);

  function renderList(list: RankedPlayer[], emptyText: string) {
    if (list.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {list.map((player, i) => (
          <RankingRow key={player.id} player={player} position={i + 1} t={t.rankings} />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
      <div>
        <Link
          href="/community"
          aria-label={t.rankings.backToCommunity}
          className="flex size-9 w-fit shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:bg-secondary/70"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">{t.rankings.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.rankings.subtitle}</p>
      </div>

      <Tabs defaultValue="global">
        <TabsList className="h-auto w-fit gap-2 rounded-full bg-transparent p-0 group-data-horizontal/tabs:h-auto">
          <TabsTrigger
            value="friends"
            className="h-auto flex-none rounded-full border-none px-4 py-2 text-sm font-medium text-foreground/70 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none active:bg-secondary/60 dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground"
          >
            {t.rankings.tabFriends}
          </TabsTrigger>
          <TabsTrigger
            value="club"
            className="h-auto flex-none rounded-full border-none px-4 py-2 text-sm font-medium text-foreground/70 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none active:bg-secondary/60 dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground"
          >
            {t.rankings.tabClub}
          </TabsTrigger>
          <TabsTrigger
            value="global"
            className="h-auto flex-none rounded-full border-none px-4 py-2 text-sm font-medium text-foreground/70 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none active:bg-secondary/60 dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground"
          >
            {t.rankings.tabGlobal}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4">
          {renderList(friends, t.rankings.emptyFriends)}
        </TabsContent>
        <TabsContent value="club" className="mt-4">
          {renderList(club, hasClub ? t.rankings.emptyClubNoPlayers : t.rankings.emptyClub)}
        </TabsContent>
        <TabsContent value="global" className="mt-4">
          {renderList(global, t.rankings.emptyGlobal)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
