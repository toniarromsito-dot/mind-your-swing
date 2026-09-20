import Link from "next/link";
import Image from "next/image";
import { PlayCircle, Clock } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { AprendeBackLink } from "@/components/aprende-back-link";

// La rutina pre-golpe es también el segundo tema mental del diccionario
// (t.coach.topics) — reutilizamos su body real en vez de repetir el
// subtítulo del hub, igual que hacía la página combinada anterior.
const PRE_SHOT_ROUTINE_TOPIC_INDEX = 1;
const MENTAL_TOPICS_COUNT = 8;

export default async function ExercisesPage() {
  await requireUserId();
  const { t } = await getDictionary();
  const technicalCount = t.coach.topics.length - MENTAL_TOPICS_COUNT;
  const preShotRoutineTopic = t.coach.topics.slice(technicalCount)[PRE_SHOT_ROUTINE_TOPIC_INDEX];

  // Duración estimada de cada herramienta — una estimación razonable de
  // cuánto se tarda en completarla, no un dato de progreso personal
  // fabricado: eso exigiría un seguimiento de sesiones que la app
  // todavía no tiene.
  const practiceTools = [
    {
      key: "preShotRoutine",
      href: "/aprende/rutina",
      title: t.preShotRoutine.title,
      description: preShotRoutineTopic.body,
      durationMinutes: 2,
    },
    {
      key: "mentalReset",
      href: "/aprende/ejercicios/reset-mental",
      title: t.exercises.mentalReset.title,
      description: t.exercises.mentalReset.description,
      durationMinutes: 2,
    },
    {
      key: "breathing",
      href: "/aprende/ejercicios/respiracion",
      title: t.exercises.breathing.title,
      description: t.exercises.breathing.description,
      durationMinutes: 3,
    },
    {
      key: "visualization",
      href: "/aprende/ejercicios/visualizacion",
      title: t.exercises.visualization.title,
      description: t.exercises.visualization.description,
      durationMinutes: 3,
    },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
      <AprendeBackLink label={t.coach.title} />

      <div className="relative -mx-4 h-40 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:w-full sm:rounded-3xl">
        <Image src={DASHBOARD_PHOTOS.play} alt="" fill sizes="(min-width: 640px) 600px, 100vw" className="object-cover" priority />
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.exercises.hubTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.exercises.hubSubtitle}</p>
      </div>

      <div className="flex flex-col gap-2">
        {practiceTools.map((tool) => (
          <Link
            key={tool.key}
            href={tool.href}
            className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm active:bg-secondary/30"
          >
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PlayCircle className="size-5" strokeWidth={1.5} />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{tool.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{tool.description}</span>
              <span className="mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground/80">
                <Clock className="size-3" strokeWidth={1.5} />
                {tool.durationMinutes} min
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
