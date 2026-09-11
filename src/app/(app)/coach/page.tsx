import Link from "next/link";
import {
  Camera,
  Hand,
  PersonStanding,
  Move,
  Target,
  AlertTriangle,
  Flag as FlagIcon,
  MapPinned,
  BookOpen,
  Sparkles,
  ScanEye,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoCard } from "@/components/video-card";
import { buttonVariants } from "@/components/ui/button";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/current-locale";

const TOPIC_ICONS = [Hand, PersonStanding, Move, Target, AlertTriangle, Sparkles, MapPinned, BookOpen, FlagIcon];
const AI_STEP_ICONS = [Camera, ScanEye, Bot];

export default async function LearnPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true } });
  const { t } = await getDictionary();
  const isPro = user.plan === "PRO";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.coach.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.coach.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3">
        {t.coach.topics.map((topic, i) => {
          const Icon = TOPIC_ICONS[i % TOPIC_ICONS.length];
          return (
            <Card key={topic.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <CardTitle className="font-heading text-lg">{topic.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{topic.body}</p>
              </CardContent>
            </Card>
          );
        })}
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

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-xl">{t.coach.aiExplainer.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.coach.aiExplainer.subtitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {t.coach.aiExplainer.steps.map((step, i) => {
            const Icon = AI_STEP_ICONS[i % AI_STEP_ICONS.length];
            return (
              <Card key={step.title}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <CardTitle className="font-heading text-base">{step.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

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
