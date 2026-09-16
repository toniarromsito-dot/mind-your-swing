import Link from "next/link";
import Image from "next/image";
import { Dumbbell, Compass, Camera, GraduationCap, PlayCircle, ChevronRight } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { PageTransition } from "@/components/page-transition";

/**
 * Aprende ya no es una página larga de scroll: es un menú de 4 tarjetas
 * (Ejercicios/Explora/Analiza tu swing/Academia) + una fila ancha
 * (Vídeos) — cada una lleva a su propia pantalla. El contenido real de
 * cada sección vive ahora en su propia ruta (ver aprende/ejercicios,
 * aprende/explora, aprende/academia, aprende/tutoriales); "Analiza tu
 * swing" sigue siendo aprende/videos (IA Swing, ya existente).
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
    },
    {
      href: "/aprende/explora",
      icon: Compass,
      title: t.coach.exploreTitle,
      description: t.coach.menuExploreDescription,
    },
    {
      href: "/aprende/videos",
      icon: Camera,
      title: t.swingVideos.navLink,
      description: t.coach.analyzeSwingCard.subtitle,
    },
    {
      href: "/aprende/academia",
      icon: GraduationCap,
      title: t.coach.academyTitle,
      description: t.coach.menuAcademyDescription,
    },
  ];

  return (
    <PageTransition>
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div className="relative -mx-4 h-48 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:w-full sm:rounded-3xl">
          <Image
            src={DASHBOARD_PHOTOS.learn}
            alt=""
            fill
            sizes="(min-width: 640px) 600px, 100vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h1 className="font-heading text-3xl font-semibold text-white">{t.coach.title}</h1>
            <p className="mt-1 text-sm text-white/80">{t.coach.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="flex flex-col gap-2 rounded-2xl border border-border/70 p-4 transition-colors hover:border-primary/40"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <tile.icon className="size-4.5" strokeWidth={1.5} />
              </span>
              <span className="text-sm font-semibold">{tile.title}</span>
              <span className="text-xs leading-snug text-muted-foreground">{tile.description}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/aprende/tutoriales"
          className="flex items-center gap-3 rounded-2xl border border-border/70 p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PlayCircle className="size-4.5" strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t.coach.videosTitle}</span>
            <span className="block text-xs text-muted-foreground">{t.coach.menuVideosDescription}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </PageTransition>
  );
}
