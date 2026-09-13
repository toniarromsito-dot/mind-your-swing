import Link from "next/link";
import Image from "next/image";
import { Camera, Hand, PersonStanding, Move, Target, AlertTriangle, Flag as FlagIcon, MapPinned, BookOpen, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { VideoCard } from "@/components/video-card";
import { MindMark } from "@/components/mind-mark";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/current-locale";
import { hasProAccess } from "@/lib/plan";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TOPIC_ICONS = [Hand, PersonStanding, Move, Target, AlertTriangle, Sparkles, MapPinned, BookOpen, FlagIcon];

// Agrupación visual de los temas de fundamentos en las 5 categorías de la
// Academia. Por índice (no por texto) para no depender de traducciones.
// El número de temas de fundamentos NO es el mismo en todos los idiomas
// (el inglés tiene uno más, "How to practice") — los 6 últimos del array
// SIEMPRE son los de juego mental añadidos después (presión, rutina
// pre-golpe, errores, confianza, enfoque, visualización), en ese orden,
// así que su posición se calcula desde el final, no con un índice fijo.
const MENTAL_TOPICS_COUNT = 6;
const PRE_SHOT_ROUTINE_OFFSET_FROM_END = 5; // 2º de los 6 últimos → length - 6 + 1

type CategoryKey = keyof Dictionary["coach"]["categoryLabels"];
function categoryRanges(topicCount: number): { key: CategoryKey; start: number; end: number | null }[] {
  const mentalStart = topicCount - MENTAL_TOPICS_COUNT;
  return [
    { key: "fundamentos", start: 0, end: 3 },
    { key: "swing", start: 3, end: 5 },
    { key: "golpes", start: 5, end: 7 },
    { key: "campo", start: 7, end: mentalStart },
    { key: "mental", start: mentalStart, end: null },
  ];
}

export default async function LearnPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, email: true } });
  const { t } = await getDictionary();
  const isPro = hasProAccess(user);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.coach.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.coach.subtitle}</p>
      </div>

      <Link href="/coach/videos" className="group block">
        <div className="relative h-56 overflow-hidden rounded-3xl shadow-md transition-transform group-hover:-translate-y-0.5 sm:h-64">
          <Image
            src={DASHBOARD_PHOTOS.learn}
            alt=""
            fill
            sizes="(min-width: 640px) 600px, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <div className="relative flex h-full flex-col justify-between p-5">
            <span className="ml-auto rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {t.swingVideos.progressPill}
            </span>
            <div>
              <p className="font-heading text-2xl font-semibold text-white">{t.coach.analyzeSwingCard.title}</p>
              <p className="mt-1 text-sm text-white/80">{t.coach.analyzeSwingCard.subtitle}</p>
              <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary shadow-sm">
                <Camera className="size-4" />
                {t.coach.analyzeSwingCard.cta}
              </span>
            </div>
          </div>
        </div>
      </Link>

      <div className="flex flex-col gap-5">
        <h2 className="font-heading text-xl">{t.coach.academyTitle}</h2>

        {categoryRanges(t.coach.topics.length).map(({ key, start, end }) => {
          const topics = t.coach.topics.slice(start, end ?? t.coach.topics.length);
          const preShotRoutineIndex = t.coach.topics.length - PRE_SHOT_ROUTINE_OFFSET_FROM_END;
          return (
            <div key={key} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">{t.coach.categoryLabels[key]}</h3>
              {topics.map((topic, i) => {
                const globalIndex = start + i;
                const Icon = TOPIC_ICONS[globalIndex % TOPIC_ICONS.length];
                return (
                  <details
                    key={topic.title}
                    className="group rounded-2xl border border-border bg-card [&::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <span className="flex-1 text-sm font-medium">{topic.title}</span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-4 pl-[3.25rem]">
                      <p className="text-sm text-muted-foreground">{topic.body}</p>
                      {globalIndex === preShotRoutineIndex && (
                        <Link
                          href="/coach/rutina"
                          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          {t.preShotRoutine.practiceCta}
                          <ChevronRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          );
        })}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{t.coach.categoryLabels.mental}</h3>
          <Link
            href="/mind"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-secondary/40"
          >
            <MindMark size="sm" />
            <span className="flex-1">
              <span className="block text-sm font-medium">{t.home.coachCard}</span>
              <span className="block text-xs text-muted-foreground">{t.coach.mentalGameBody}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>
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
    </div>
  );
}
