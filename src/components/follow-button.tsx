"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { followUser, unfollowUser } from "@/actions/social";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function FollowButton({
  targetUserId,
  initiallyFollowing,
  t,
}: {
  targetUserId: string;
  initiallyFollowing: boolean;
  t: Dictionary["community"];
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      try {
        if (next) await followUser(targetUserId);
        else await unfollowUser(targetUserId);
      } catch (err) {
        setFollowing(!next);
        toast.error(err instanceof Error ? err.message : t.followError);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
        following ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
      )}
    >
      {following ? t.unfollow : t.follow}
    </button>
  );
}
