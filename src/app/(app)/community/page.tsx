import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Trophy, ListOrdered, ChevronRight, CircleUserRound } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { canUseFeature } from "@/lib/entitlements";
import {
  listFollowingIds,
  listStoriesForFeed,
  getCurrentChallenge,
  hasJoinedChallenge,
} from "@/lib/data/social";
import { CommunityFeed } from "@/components/community-feed";
import { ChallengeCard } from "@/components/challenge-card";
import { NewPostDrawer } from "@/components/new-post-drawer";
import type { StoryForCard } from "@/components/story-card";
import { getDictionary } from "@/lib/i18n/current-locale";
import { PageTransition } from "@/components/page-transition";

function serialize(
  stories: Awaited<ReturnType<typeof listStoriesForFeed>>
): StoryForCard[] {
  return stories.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    comments: {
      count: s.comments.count,
      items:
        s.comments.items?.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
        })) ?? null,
    },
  }));
}

export default async function CommunityPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const isPro = canUseFeature(user, "COMMUNITY_REPLIES");

  const [all, friends, campo, consejo, followingIds, challenge] = await Promise.all([
    listStoriesForFeed("all", userId, isPro),
    listStoriesForFeed("friends", userId, isPro),
    listStoriesForFeed("campo", userId, isPro),
    listStoriesForFeed("consejo", userId, isPro),
    listFollowingIds(userId),
    getCurrentChallenge(),
  ]);
  const joined = await hasJoinedChallenge(challenge.id, userId);

  return (
    <PageTransition>
      <div className="flex flex-col bg-background">
        <div className="relative flex h-[26vh] min-h-[190px] shrink-0 flex-col justify-between overflow-hidden px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-4 sm:px-6">
          <Image src="/images/play-hero.jpg" alt="" fill sizes="100vw" className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/45" />
          <div className="relative flex items-center justify-between">
            <Link
              href="/dashboard"
              aria-label={t.nav.home}
              className="flex size-9 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <Link
              href="/perfil"
              aria-label={t.nav.perfil}
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
            >
              <CircleUserRound className="size-5" />
            </Link>
          </div>
          <div className="relative">
            <h1 className="font-heading text-4xl font-bold text-white">{t.community.title}</h1>
            <p className="mt-1 text-sm text-white/85">{t.community.heroTagline}</p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4 pb-24 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/community/tournaments"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-secondary/40"
            >
              <Trophy className="size-4 text-primary" />
              {t.community.viewTournaments}
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>
            <Link
              href="/community/ranking"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-secondary/40"
            >
              <ListOrdered className="size-4 text-primary" />
              {t.community.viewRanking}
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>
          </div>

          <ChallengeCard
            challengeId={challenge.id}
            title={challenge.title}
            description={challenge.description}
            joinedCount={challenge._count.participants}
            targetParticipants={challenge.targetParticipants}
            initiallyJoined={joined}
            t={t.community}
          />

          <CommunityFeed
            viewerId={userId}
            followingIds={followingIds}
            isPro={isPro}
            stories={{
              all: serialize(all),
              friends: serialize(friends),
              campo: serialize(campo),
              consejo: serialize(consejo),
            }}
            t={t.community}
            dateLocale={t.dateLocale}
          />
        </div>

        <NewPostDrawer t={t.community} />
      </div>
    </PageTransition>
  );
}
