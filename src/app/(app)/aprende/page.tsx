import Link from "next/link";
import Image from "next/image";
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
  ChevronDown,
  ChevronRight,
  Wind,
  RefreshCw,
  Eye,
  Compass,
} from "lucide-react";
import { VideoCard } from "@/components/video-card";
import { MindMark } from "@/components/mind-mark";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/current-locale";
import { hasProAccess } from "@/lib/plan";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TOPIC_ICONS = [Hand, PersonStanding, Move, Target, AlertTriangle, Sparkles, MapPinned, BookOpen, FlagIcon];

// Los módulos de juego mental (Aprende) reutilizan la misma fotografía ya
// integrada en el resto de la app — nada de bancos de imágenes nuevos.
// Se repiten cíclicamente entre los módulos.
const MENTAL_MODULE_PHOTOS = [DASHBOARD_PHOTOS.coach, DASHBOARD_PHOTOS.play, DASHBOARD_PHOTOS.learn, DASHBOARD_PHOTOS.community];

// El número de temas TÉCNICOS (grip, postura...) no es el mismo en todos
// los idiomas (el inglés tiene uno más, "How to practice") — los 8
// últimos del array SIEMPRE son los de juego mental añadidos después
// (presión, rutina pre-golpe, errores, confianza, enfoque, visualización,
// competición, últimos hoyos), en ese orden, así que se separan desde el
// final, no con un índice fijo.
const MENTAL_TOPICS_COUNT = 8;
const PRE_SHOT_ROUTINE_INDEX_IN_MENTAL = 1; // 2º de los 8: presión, [rutina pre-golpe], errores...

type CategoryKey = keyof Dictionary["coach"]["categoryLabels"];
function technicalCategoryRanges(technicalCount: number): { key: CategoryKey; start: number; end: number | null }[] {
  return [
    { key: "fundamentos", start: 0, end: 3 },
    { key: "swing", start: 3, end: 5 },
    { key: "golpes", start: 5, end: 7 },
    { key: "campo", start: 7, end: technicalCount },
  ];
}

export default async function LearnPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, email: true } });
  const { t } = await getDictionary();
  const isPro = hasProAccess(user);
  const technicalCount = t.coach.topics.length - MENTAL_TOPICS_COUNT;
  const mentalTopics = t.coach.topics.slice(technicalCount);

  const exerciseCards = [
    {
      key: "preShotRoutine",
      href: "/aprende/rutina",
      icon: Compass,
      title: t.preShotRoutine.title,
      description: mentalTopics[PRE_SHOT_ROUTINE_INDEX_IN_MENTAL].body,
    },
    { key: "breathing", href: "/aprende/ejercicios/respiracion", icon: Wind, title: t.exercises.breathing.title, description: t.exercises.breathing.description },
    { key: "mentalReset", href: "/aprende/ejercicios/reset-mental", icon: RefreshCw, title: t.exercises.mentalReset.title, description: t.exercises.mentalReset.description },
    { key: "visualization", href: "/aprende/ejercicios/visualizacion", icon: Eye, title: t.exercises.visualization.title, description: t.exercises.visualization.description },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t.coach.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.coach.subtitle}</p>
      </div>

      {/* Los 3 pilares de Aprende, tal y como pide el producto: Vídeos,
          Ejercicios, IA Swing — cada uno con un propósito claro y
          distinto, en vez de todo apilado en una sola pantalla larga. */}
      <Tabs defaultValue="videos">
        <TabsList>
          <TabsTrigger value="videos">{t.coach.categoryLabels.mental}</TabsTrigger>
          <TabsTrigger value="ejercicios">{t.exercises.hubTitle}</TabsTrigger>
          <TabsTrigger value="swing">{t.swingVideos.navLink}</TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t.coach.mentalGameBody}</p>

          <div className="flex flex-col gap-3">
            {mentalTopics.map((topic, i) => {
              const href = i === PRE_SHOT_ROUTINE_INDEX_IN_MENTAL ? "/aprende/rutina" : undefined;
              const photo = MENTAL_MODULE_PHOTOS[i % MENTAL_MODULE_PHOTOS.length];
              const content = (
                <Card className="h-full flex-row items-stretch overflow-hidden border-border/70 gap-0 py-0 shadow-none transition-transform hover:-translate-y-0.5">
                  <div className="relative size-24 shrink-0">
                    <Image src={photo} alt="" fill sizes="96px" className="object-cover" />
                  </div>
                  <CardContent className="flex flex-1 flex-col justify-center gap-1 p-4">
                    <p className="font-heading text-base font-semibold">{topic.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{topic.body}</p>
                  </CardContent>
                </Card>
              );
              return href ? (
                <Link key={topic.title} href={href}>
                  {content}
                </Link>
              ) : (
                <div key={topic.title}>{content}</div>
              );
            })}
          </div>

          <Link
            href="/coach"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-secondary/40"
          >
            <MindMark size="sm" />
            <span className="flex-1">
              <span className="block text-sm font-medium">{t.home.coachCard}</span>
              <span className="block text-xs text-muted-foreground">{t.coach.mentalGameBody}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </TabsContent>

        <TabsContent value="ejercicios" className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t.exercises.hubSubtitle}</p>
          {exerciseCards.map((ex) => (
            <Link
              key={ex.key}
              href={ex.href}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-secondary/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ex.icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{ex.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{ex.description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="swing" className="mt-4">
          <Link href="/aprende/videos" className="group block">
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
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-5">
        <h2 className="font-heading text-lg font-semibold text-muted-foreground">{t.coach.academyTitle}</h2>

        {technicalCategoryRanges(technicalCount).map(({ key, start, end }) => {
          const topics = t.coach.topics.slice(start, end ?? t.coach.topics.length);
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
                    <p className="px-4 pb-4 pl-[3.25rem] text-sm text-muted-foreground">{topic.body}</p>
                  </details>
                );
              })}
            </div>
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
    </div>
  );
}
