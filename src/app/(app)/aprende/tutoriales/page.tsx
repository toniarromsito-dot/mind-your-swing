import Image from "next/image";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/current-locale";
import { canUseFeature } from "@/lib/entitlements";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { VideoCard } from "@/components/video-card";
import { AprendeBackLink } from "@/components/aprende-back-link";

export default async function TutorialsPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, email: true } });
  const { t } = await getDictionary();
  const isPro = canUseFeature(user, "LEARN_VIDEOS");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
      <AprendeBackLink label={t.coach.title} />

      <div className="relative -mx-4 h-40 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:w-full sm:rounded-3xl">
        <Image src={DASHBOARD_PHOTOS.learn} alt="" fill sizes="(min-width: 640px) 600px, 100vw" className="object-cover" priority />
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.coach.videosTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.coach.videosSubtitle}</p>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t.coach.freeVideosTitle}</h2>
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
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t.coach.proVideosTitle}</h2>
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
                proBadgeLabel={t.coach.proBadge}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">{t.coach.disclaimer}</p>
    </div>
  );
}
