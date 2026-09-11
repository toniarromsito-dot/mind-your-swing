import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { listMySwingVideos } from "@/lib/data/swing-videos";
import { getDictionary } from "@/lib/i18n/current-locale";
import { SwingVideosSection } from "@/components/swing-videos-section";
import { ProUpsell } from "@/components/pro-upsell";
import { hasProAccess } from "@/lib/plan";

export default async function SwingVideosPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, email: true } });
  const { t } = await getDictionary();

  if (!hasProAccess(user)) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <ProUpsell t={t.landing} />
      </div>
    );
  }

  const videos = await listMySwingVideos(userId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">{t.swingVideos.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.swingVideos.subtitle}</p>
      </div>

      <p className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        {t.swingVideos.disclaimer}
      </p>

      <SwingVideosSection
        videos={videos.map((v) => ({
          id: v.id,
          videoUrl: v.videoUrl,
          note: v.note,
          score: v.score,
          aiFeedback: v.aiFeedback,
          feedback: v.feedback,
          status: v.status,
          createdAt: v.createdAt.toISOString(),
        }))}
        t={t.swingVideos}
        dateLocale={t.dateLocale}
      />
    </div>
  );
}
