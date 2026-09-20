"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Heart, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";
import { toggleLike, addComment, deleteComment } from "@/actions/social";
import { StoryDeleteButton } from "@/components/story-delete-button";
import { FollowButton } from "@/components/follow-button";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type StoryForCard = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  userId: string;
  user: { id: string; name: string | null; image: string | null };
  likes: { userId: string }[];
  comments: {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    user: { id: string; name: string | null; image: string | null };
  }[];
};

export function StoryCard({
  story,
  viewerId,
  isFollowing,
  t,
  dateLocale,
}: {
  story: StoryForCard;
  viewerId: string;
  isFollowing: boolean | null;
  t: Dictionary["community"];
  dateLocale: string;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isPending, startTransition] = useTransition();

  const liked = story.likes.some((l) => l.userId === viewerId);
  const isMine = story.userId === viewerId;

  function handleLike() {
    startTransition(async () => {
      try {
        await toggleLike(story.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.likeError);
      }
    });
  }

  function handleComment() {
    const content = commentText.trim();
    if (!content) return;
    startTransition(async () => {
      try {
        await addComment(story.id, content);
        setCommentText("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.commentError);
      }
    });
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      try {
        await deleteComment(commentId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.deleteCommentError);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        {story.user.image ? (
          <Image src={story.user.image} alt={story.user.name ?? ""} width={28} height={28} className="rounded-full" />
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs text-secondary-foreground">
            {story.user.name?.[0] ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">{story.user.name}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(story.createdAt).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        {!isMine && isFollowing != null && (
          <FollowButton targetUserId={story.userId} initiallyFollowing={isFollowing} t={t} />
        )}
      </div>

      <h2 className="font-heading text-lg">{story.title}</h2>
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">{story.content}</p>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleLike}
          disabled={isPending}
          className={cn(
            "flex items-center gap-1.5 text-sm transition-colors disabled:opacity-50",
            liked ? "text-destructive" : "text-muted-foreground active:text-foreground"
          )}
        >
          <Heart className={cn("size-4", liked && "fill-current")} />
          {story.likes.length}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors active:text-foreground"
        >
          <MessageCircle className="size-4" />
          {story.comments.length}
        </button>
        {isMine && (
          <span className="ml-auto">
            <StoryDeleteButton storyId={story.id} t={t} />
          </span>
        )}
      </div>

      {showComments && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {story.comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2">
              <p className="text-sm">
                <span className="font-medium">{c.user.name}</span> <span className="text-muted-foreground">{c.content}</span>
              </p>
              {c.userId === viewerId && (
                <button
                  type="button"
                  onClick={() => handleDeleteComment(c.id)}
                  aria-label="Delete comment"
                  className="shrink-0 text-muted-foreground/60 active:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleComment();
              }}
              placeholder={t.commentPlaceholder}
              className="flex-1 rounded-full border border-border bg-background px-3.5 py-1.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleComment}
              disabled={isPending || commentText.trim().length === 0}
              aria-label={t.commentSubmit}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
