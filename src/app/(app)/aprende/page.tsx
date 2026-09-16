import Link from "next/link";
import Image from "next/image";
import {
  Dumbbell,
  Compass,
  Video,
  GraduationCap,
  PlayCircle,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { PageTransition } from "@/components/page-transition";

/**
 * Menú de Aprende, inmersivo como Home (ver isImmersivePage en
 * app-shell.tsx): sin cabecera ni barra inferior, solo la foto a
 * pantalla completa, el logo grande y la flecha de atrás. Cada tarjeta
 * lleva a su propia pantalla (ver aprende/ejercicios, /explora,
 * /academia, /tutoriales; "Analiza tu swing" sigue siendo aprende/videos,
 * la función de IA Swing ya existente).
 */
export default async function LearnMenuPage() {
  await requireUserId();
  const { t } = await getDictionary();

  const tiles = [
    {
      href: "/aprende/ejercicios",
      icon: Dumbbell,
      title: t.exercises.hubTitle,
      description: t.coach.menuExercisesDescription,
      photo: "/images/coach-topic-ball.jpg",
    },
    {
      href: "/aprende/explora",
      icon: Compass,
      title: t.coach.exploreTitle,
      description: t.coach.menuExploreDescription,
      photo: DASHBOARD_PHOTOS.community,
    },
    {
      href: "/aprende/videos",
      icon: Video,
      title: t.swingVideos.navLink,
      description: t.coach.analyzeSwingCard.subtitle,
      photo: DASHBOARD_PHOTOS.play,
    },
    {
      href: "/aprende/academia",
      icon: GraduationCap,
      title: t.coach.academyTitle,
      description: t.coach.menuAcademyDescription,
      photo: DASHBOARD_PHOTOS.coach,
    },
  ];

  return (
    <PageTransition>
      <div className="relative">
        {/* Foto a pantalla completa detrás de toda la página (como Home,
            ver isImmersivePage en app-shell.tsx), no solo detrás del hero. */}
        <Image
          src="/images/aprende-hero.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_35%]"
          priority
        />
        <div className="relative flex flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-8 sm:px-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              aria-label={t.exercises.hubTitle}
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
            >
              <ChevronLeft className="size-5" />
            </Link>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-sans text-4xl font-bold tracking-tight text-white">
              MYS
            </span>
            <span className="mt-0.5 text-sm text-white/90">
              Mind Your Swing
            </span>
          </div>
          <div className="mt-4">
            <h1 className="font-heading text-5xl font-bold text-white">
              {t.coach.title}
            </h1>
            <p className="mt-1 text-lg text-white/90">{t.coach.subtitle}</p>
            <p className="mt-3 max-w-sm text-sm text-white/80">
              {t.coach.menuLongSubtitle}
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-3">
              {tiles.map((tile) => (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="relative flex min-h-[230px] flex-col justify-between gap-2 overflow-hidden rounded-2xl p-4 shadow-sm"
                >
                  <Image
                    src={tile.photo}
                    alt=""
                    fill
                    sizes="200px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                      <tile.icon className="size-5" strokeWidth={1.6} />
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                  <div className="relative z-10">
                    <p className="text-base font-semibold text-white">
                      {tile.title}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-white/85">
                      {tile.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href="/aprende/tutoriales"
              className="relative flex min-h-[92px] items-center gap-3 overflow-hidden rounded-2xl p-4 shadow-sm"
            >
              <Image
                src="/images/coach-topic-tree.jpg"
                alt=""
                fill
                sizes="400px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/15" />
              <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                <PlayCircle className="size-5" strokeWidth={1.6} />
              </span>
              <span className="relative z-10 min-w-0 flex-1">
                <span className="block text-base font-semibold text-white">
                  {t.coach.videosTitle}
                </span>
                <span className="block text-xs text-white/85">
                  {t.coach.menuVideosDescription}
                </span>
              </span>
              <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
                <ArrowRight className="size-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
