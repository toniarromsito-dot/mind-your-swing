import Link from "next/link";
import { Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoCard } from "@/components/video-card";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function LearnPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } });
  const { t } = await getDictionary();
  const isPro = user.plan === "PRO";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl">{t.coach.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.coach.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3">
        {t.coach.topics.map((topic) => (
          <Card key={topic.title}>
            <CardHeader>
              <CardTitle className="font-heading text-lg">{topic.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{topic.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-heading text-xl">{t.coach.videosTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.coach.videosSubtitle}</p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t.coach.freeVideosTitle}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.coach.freeVideos.map((video) => (
              <VideoCard
                key={video.title}
                title={video.title}
                description={video.description}
                url={video.url}
                comingSoonLabel={t.coach.comingSoon}
                lockedMessage={t.coach.proLockedMessage}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t.coach.proVideosTitle}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.coach.proVideos.map((video) => (
              <VideoCard
                key={video.title}
                title={video.title}
                description={video.description}
                url={video.url}
                locked={!isPro}
                comingSoonLabel={t.coach.comingSoon}
                lockedMessage={t.coach.proLockedMessage}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        {t.coach.disclaimer}
      </p>

      <Card>
        <CardContent className="flex flex-col items-start gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Camera className="size-6 text-primary" />
            <div>
              <p className="font-heading text-base">{t.swingVideos.navLink}</p>
              <p className="text-sm text-muted-foreground">{t.swingVideos.subtitle}</p>
            </div>
          </div>
          <Link href="/coach/videos" className={buttonVariants({ size: "sm" })}>
            {t.swingVideos.navLink}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
