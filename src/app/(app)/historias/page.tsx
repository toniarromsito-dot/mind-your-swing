import Image from "next/image";
import { requireUserId } from "@/lib/require-user";
import { listStories } from "@/lib/data/stories";
import { StoryForm } from "@/components/story-form";
import { StoryDeleteButton } from "@/components/story-delete-button";
import { Card, CardContent } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function StoriesPage() {
  const userId = await requireUserId();
  const stories = await listStories();
  const { t } = await getDictionary();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">{t.stories.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.stories.subtitle}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <StoryForm t={t.stories} />
        </CardContent>
      </Card>

      {stories.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.stories.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {stories.map((story) => (
            <Card key={story.id}>
              <CardContent className="flex flex-col gap-2 pt-6">
                <div className="flex items-center gap-2">
                  {story.user.image ? (
                    <Image
                      src={story.user.image}
                      alt={story.user.name ?? ""}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs text-secondary-foreground">
                      {story.user.name?.[0] ?? "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{story.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(story.createdAt).toLocaleDateString(t.dateLocale, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <h2 className="font-heading text-lg">{story.title}</h2>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{story.content}</p>
                {story.userId === userId && (
                  <div className="pt-1">
                    <StoryDeleteButton storyId={story.id} t={t.stories} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
