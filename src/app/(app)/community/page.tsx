import Link from "next/link";
import { Trophy, ListOrdered, ChevronRight } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listFollowingIds, listStoriesForFeed } from "@/lib/data/social";
import { StoryForm } from "@/components/story-form";
import { StoryCard, type StoryForCard } from "@/components/story-card";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDictionary } from "@/lib/i18n/current-locale";
import { PageTransition } from "@/components/page-transition";

function serialize(
  stories: Awaited<ReturnType<typeof listStoriesForFeed>>
): StoryForCard[] {
  return stories.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    comments: s.comments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  }));
}

export default async function CommunityPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const [feed, friends, club, followingIds, me] = await Promise.all([
    listStoriesForFeed("feed", userId),
    listStoriesForFeed("friends", userId),
    listStoriesForFeed("club", userId),
    listFollowingIds(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { club: true } }),
  ]);
  const followingSet = new Set(followingIds);
  const emptyClubText = me?.club
    ? t.community.emptyClubNoStories
    : t.community.emptyClub;

  function renderStories(stories: StoryForCard[], emptyText: string) {
    if (stories.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {stories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            viewerId={userId}
            isFollowing={
              story.userId === userId ? null : followingSet.has(story.userId)
            }
            t={t.community}
            dateLocale={t.dateLocale}
          />
        ))}
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {t.community.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.community.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/community/tournaments"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-secondary/40"
            >
              <Trophy className="size-4 text-primary" />
              {t.community.viewTournaments}
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>
            <Link
              href="/community/ranking"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-secondary/40"
            >
              <ListOrdered className="size-4 text-primary" />
              {t.community.viewRanking}
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <StoryForm t={t.community} />
          </CardContent>
        </Card>

        <Tabs defaultValue="feed">
          <TabsList>
            <TabsTrigger value="feed">{t.community.tabFeed}</TabsTrigger>
            <TabsTrigger value="friends">{t.community.tabFriends}</TabsTrigger>
            <TabsTrigger value="club">{t.community.tabClub}</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-4">
            {renderStories(serialize(feed), t.community.empty)}
          </TabsContent>
          <TabsContent value="friends" className="mt-4">
            {renderStories(serialize(friends), t.community.emptyFriends)}
          </TabsContent>
          <TabsContent value="club" className="mt-4">
            {renderStories(serialize(club), emptyClubText)}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
