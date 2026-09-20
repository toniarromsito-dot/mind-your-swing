import Image from "next/image";
import { Gauge, Compass, AlertTriangle, Sparkles, Target, Eye, Trophy, Flag as FlagIcon, ChevronDown } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { AprendeBackLink } from "@/components/aprende-back-link";

// Los 8 temas de juego mental, en el mismo orden que el diccionario:
// presión, rutina pre-golpe, errores, confianza, enfoque, visualización,
// competición, últimos hoyos.
const MENTAL_TOPIC_ICONS = [Gauge, Compass, AlertTriangle, Sparkles, Target, Eye, Trophy, FlagIcon];
const MENTAL_TOPICS_COUNT = 8;

export default async function ExplorePage() {
  await requireUserId();
  const { t } = await getDictionary();
  const technicalCount = t.coach.topics.length - MENTAL_TOPICS_COUNT;
  const mentalTopics = t.coach.topics.slice(technicalCount);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
      <AprendeBackLink label={t.coach.title} />

      <div className="relative -mx-4 h-40 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:w-full sm:rounded-3xl">
        <Image src={DASHBOARD_PHOTOS.learn} alt="" fill sizes="(min-width: 640px) 600px, 100vw" className="object-cover" priority />
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.coach.exploreTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.coach.menuExploreDescription}</p>
      </div>

      <div className="flex flex-col gap-2">
        {mentalTopics.map((topic, i) => {
          const Icon = MENTAL_TOPIC_ICONS[i % MENTAL_TOPIC_ICONS.length];
          return (
            <details key={topic.title} className="group rounded-2xl border border-border bg-card [&::-webkit-details-marker]:hidden">
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
    </div>
  );
}
