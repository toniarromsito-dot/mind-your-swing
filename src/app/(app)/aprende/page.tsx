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
  Eye,
  Compass,
  Gauge,
  Trophy,
  PlayCircle,
  Clock,
  Brain,
} from "lucide-react";
import { VideoCard } from "@/components/video-card";
import { PageTransition } from "@/components/page-transition";
import { requireUserId } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n/current-locale";
import { hasProAccess } from "@/lib/plan";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TOPIC_ICONS = [
  Hand,
  PersonStanding,
  Move,
  Target,
  AlertTriangle,
  Sparkles,
  MapPinned,
  BookOpen,
  FlagIcon,
];

// Los 8 temas de juego mental, en el mismo orden que el diccionario:
// presión, rutina pre-golpe, errores, confianza, enfoque, visualización,
// competición, últimos hoyos.
const MENTAL_TOPIC_ICONS = [
  Gauge,
  Compass,
  AlertTriangle,
  Sparkles,
  Target,
  Eye,
  Trophy,
  FlagIcon,
];
const MENTAL_TOPICS_COUNT = 8;
const PRE_SHOT_ROUTINE_INDEX_IN_MENTAL = 1;

type CategoryKey = keyof Dictionary["coach"]["categoryLabels"];
function technicalCategoryRanges(
  technicalCount: number
): { key: CategoryKey; start: number; end: number | null }[] {
  return [
    { key: "fundamentos", start: 0, end: 3 },
    { key: "swing", start: 3, end: 5 },
    { key: "golpes", start: 5, end: 7 },
    { key: "campo", start: 7, end: technicalCount },
  ];
}

function mentalTopicSlug(i: number) {
  return `tema-mental-${i}`;
}

export default async function LearnPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { plan: true, email: true },
  });
  const { t } = await getDictionary();
  const isPro = hasProAccess(user);
  const technicalCount = t.coach.topics.length - MENTAL_TOPICS_COUNT;
  const mentalTopics = t.coach.topics.slice(technicalCount);
  const featuredTopic = mentalTopics[0]; // "Controla la presión" — el primer tema mental.

  // Duración estimada de cada herramienta interactiva — una estimación
  // razonable de cuánto se tarda en completarla (como el tiempo de una
  // receta), no un dato de progreso personal fabricado: eso exigiría un
  // seguimiento de sesiones que la app todavía no tiene.
  const practiceTools = [
    {
      key: "preShotRoutine",
      href: "/aprende/rutina",
      photo: DASHBOARD_PHOTOS.play,
      title: t.preShotRoutine.title,
      description: mentalTopics[PRE_SHOT_ROUTINE_INDEX_IN_MENTAL].body,
      durationMinutes: 2,
    },
    {
      key: "mentalReset",
      href: "/aprende/ejercicios/reset-mental",
      photo: DASHBOARD_PHOTOS.coach,
      title: t.exercises.mentalReset.title,
      description: t.exercises.mentalReset.description,
      durationMinutes: 2,
    },
    {
      key: "breathing",
      href: "/aprende/ejercicios/respiracion",
      photo: DASHBOARD_PHOTOS.community,
      title: t.exercises.breathing.title,
      description: t.exercises.breathing.description,
      durationMinutes: 3,
    },
    {
      key: "visualization",
      href: "/aprende/ejercicios/visualizacion",
      photo: DASHBOARD_PHOTOS.learn,
      title: t.exercises.visualization.title,
      description: t.exercises.visualization.description,
      durationMinutes: 3,
    },
  ];

  // 5 categorías destacadas de acceso rápido — el resto de los 8 temas
  // mentales sigue accesible en la lista completa de abajo, solo no
  // tienen su propio icono en esta cuadrícula compacta.
  const exploreTiles = [
    {
      key: "mentalGame",
      icon: Brain,
      label: t.coach.categoryLabels.mental,
      anchor: "mental-topics",
    },
    {
      key: "focus",
      icon: Target,
      label: mentalTopics[4].title,
      anchor: mentalTopicSlug(4),
    },
    {
      key: "confidence",
      icon: Sparkles,
      label: mentalTopics[3].title,
      anchor: mentalTopicSlug(3),
    },
    {
      key: "pressure",
      icon: Gauge,
      label: mentalTopics[0].title,
      anchor: mentalTopicSlug(0),
    },
    {
      key: "courseStrategy",
      icon: FlagIcon,
      label: t.coach.courseStrategyLabel,
      anchor: mentalTopicSlug(7),
    },
  ];

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        {/* 1. Cabecera editorial, igual que Home: título + tagline. */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {t.coach.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.coach.subtitle}
            </p>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className="font-heading text-sm leading-tight italic">
              {t.coach.learnTagline}
            </p>
          </div>
        </div>

        {/* 2. Destacado — el primer tema mental (Controla la presión) como tarjeta fotográfica dominante. */}
        <Link href="/coach" className="group block">
          <div className="relative overflow-hidden rounded-[28px] shadow-md transition-transform group-hover:-translate-y-0.5">
            <div className="relative h-96 w-full sm:h-[26rem]">
              <Image
                src={DASHBOARD_PHOTOS.play}
                alt=""
                fill
                sizes="(min-width: 640px) 600px, 100vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
            </div>
            <div className="absolute top-5 right-5 max-w-[34%] text-right text-[9.5px] font-medium tracking-[0.15em] text-white/70 uppercase">
              {t.coach.featuredFooter}
              <span className="mt-1 block h-px w-8 bg-white/40" />
            </div>
            <div className="absolute inset-0 flex flex-col justify-end p-6">
              <span className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
                {t.coach.featuredEyebrow}
              </span>
              <p className="mt-2 max-w-[80%] font-heading text-2xl font-semibold text-white sm:max-w-md sm:text-3xl">
                {t.coach.featuredHeadline}
              </p>
              <p className="mt-2 max-w-sm text-sm text-white/80">
                {featuredTopic.body}
              </p>
              <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm">
                {t.coach.startLessonCta}
                <ChevronRight className="size-4" />
              </span>
            </div>
          </div>
        </Link>

        {/* 3. Herramientas reales de práctica (rutina, reset, respiración, visualización). */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              {t.exercises.hubTitle}
            </h2>
          </div>
          <div className="flex flex-col divide-y divide-border/60">
            {practiceTools.map((tool) => (
              <Link
                key={tool.key}
                href={tool.href}
                className="flex items-center gap-3 py-3.5"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={tool.photo}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <PlayCircle
                      className="size-5 text-white"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {tool.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {tool.description}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground/80">
                    <Clock className="size-3" strokeWidth={1.5} />
                    {tool.durationMinutes} min
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>

        {/* 4. Explora — 5 categorías destacadas de acceso rápido a la lista completa. */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            {t.coach.exploreTitle}
          </h2>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
            {exploreTiles.map((tile) => (
              <a
                key={tile.key}
                href={`#${tile.anchor}`}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/70 px-2 py-3 text-center transition-colors hover:border-primary/40"
              >
                <tile.icon
                  className="size-4.5 text-primary"
                  strokeWidth={1.5}
                />
                <span className="text-[10.5px] leading-tight font-medium">
                  {tile.label}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* 5. Juego mental — cada tema, en detalle (acordeón), con ancla para "Explora". */}
        <div id="mental-topics" className="flex scroll-mt-20 flex-col gap-2">
          {mentalTopics.map((topic, i) => {
            if (i === PRE_SHOT_ROUTINE_INDEX_IN_MENTAL) {
              const RoutineIcon = MENTAL_TOPIC_ICONS[i];
              return (
                <Link
                  key={topic.title}
                  href="/aprende/rutina"
                  id={mentalTopicSlug(i)}
                  className="flex scroll-mt-20 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-secondary/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <RoutineIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {topic.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {topic.body}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            }
            const Icon = MENTAL_TOPIC_ICONS[i % MENTAL_TOPIC_ICONS.length];
            return (
              <details
                key={topic.title}
                id={mentalTopicSlug(i)}
                className="group scroll-mt-20 rounded-2xl border border-border bg-card [&::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium">
                    {topic.title}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 pl-[3.25rem] text-sm text-muted-foreground">
                  {topic.body}
                </p>
              </details>
            );
          })}
        </div>

        {/* 6. IA Swing — sube tu vídeo y recibe feedback por fases (ya existente, restilizado). */}
        <Link
          href="/aprende/videos"
          className="group flex flex-col gap-4 rounded-3xl border border-border/70 p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center"
        >
          <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-2xl sm:h-28 sm:w-28">
            <Image
              src={DASHBOARD_PHOTOS.learn}
              alt=""
              fill
              sizes="160px"
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <PlayCircle className="size-9 text-white" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[10.5px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              {t.swingVideos.navLink}
            </span>
            <p className="font-heading text-xl font-semibold">
              {t.coach.analyzeSwingCard.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {t.coach.analyzeSwingCard.subtitle}
            </p>
            <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm">
              <Camera className="size-4" />
              {t.coach.analyzeSwingCard.cta}
            </span>
          </div>
          <div className="flex shrink-0 flex-col gap-1 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <span className="mb-0.5 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground/70 uppercase">
              {t.swingVideos.phasesTitle}
            </span>
            {/* Los 7 términos reales del vocabulario de fases, separando las
              parejas Takeaway·Backswing / Transición·Bajada /
              Impacto·Acompañamiento — que en el análisis de un vídeo
              concreto se muestran unidas porque solo se detectan 3
              transiciones reales, no fabricando 7 momentos medidos. */}
            {[
              t.swingVideos.phaseSetup,
              t.swingVideos.phaseBackswing,
              t.swingVideos.phaseDownswing,
              t.swingVideos.phaseFollowThrough,
            ]
              .flatMap((label) => label.split(" · "))
              .map((term) => (
                <span key={term}>{term}</span>
              ))}
          </div>
        </Link>

        {/* 7. Academia — fundamentos técnicos, sin cambios de contenido. */}
        <div className="flex flex-col gap-5">
          <h2 className="font-heading text-lg font-semibold text-muted-foreground">
            {t.coach.academyTitle}
          </h2>

          {technicalCategoryRanges(technicalCount).map(
            ({ key, start, end }) => {
              const topics = t.coach.topics.slice(
                start,
                end ?? t.coach.topics.length
              );
              return (
                <div key={key} className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {t.coach.categoryLabels[key]}
                  </h3>
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
                          <span className="flex-1 text-sm font-medium">
                            {topic.title}
                          </span>
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="px-4 pb-4 pl-[3.25rem] text-sm text-muted-foreground">
                          {topic.body}
                        </p>
                      </details>
                    );
                  })}
                </div>
              );
            }
          )}
        </div>

        {/* 8. Vídeos reales (enlaces, nunca generados por IA). */}
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="font-heading text-xl">{t.coach.videosTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.coach.videosSubtitle}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              {t.coach.freeVideosTitle}
            </h3>
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
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              {t.coach.proVideosTitle}
            </h3>
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
    </PageTransition>
  );
}
