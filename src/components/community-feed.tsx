"use client";

import { useState } from "react";
import { StoryCard, type StoryForCard } from "@/components/story-card";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Tab = "all" | "friends" | "campo" | "consejo";

export function CommunityFeed({
  viewerId,
  followingIds,
  stories,
  t,
  dateLocale,
}: {
  viewerId: string;
  followingIds: string[];
  stories: Record<Tab, StoryForCard[]>;
  t: Dictionary["community"];
  dateLocale: string;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const followingSet = new Set(followingIds);

  const tabs: { key: Tab; label: string; empty: string }[] = [
    { key: "all", label: t.tabAll, empty: t.empty },
    { key: "friends", label: t.tabFriends, empty: t.emptyFriends },
    { key: "campo", label: t.tabCampos, empty: t.emptyCampo },
    { key: "consejo", label: t.tabConsejos, empty: t.emptyConsejo },
  ];
  const active = tabs.find((tb) => tb.key === tab)!;
  const activeStories = stories[tab];

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === tb.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-secondary/60"
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {activeStories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          {active.empty}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {activeStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              viewerId={viewerId}
              isFollowing={story.userId === viewerId ? null : followingSet.has(story.userId)}
              t={t}
              dateLocale={dateLocale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
