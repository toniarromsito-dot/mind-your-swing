import Image from "next/image";
import { Hand, PersonStanding, Move, Target, AlertTriangle, Sparkles, MapPinned, BookOpen, Flag as FlagIcon, ChevronDown } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { AprendeBackLink } from "@/components/aprende-back-link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TOPIC_ICONS = [Hand, PersonStanding, Move, Target, AlertTriangle, Sparkles, MapPinned, BookOpen, FlagIcon];

type CategoryKey = keyof Dictionary["coach"]["categoryLabels"];
function technicalCategoryRanges(technicalCount: number): { key: CategoryKey; start: number; end: number | null }[] {
  return [
    { key: "fundamentos", start: 0, end: 3 },
    { key: "swing", start: 3, end: 5 },
    { key: "golpes", start: 5, end: 7 },
    { key: "campo", start: 7, end: technicalCount },
  ];
}

export default async function AcademyPage() {
  await requireUserId();
  const { t } = await getDictionary();
  const technicalCount = t.coach.topics.length - 8;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <AprendeBackLink label={t.coach.title} />

      <div className="relative -mx-4 h-40 w-[calc(100%+2rem)] overflow-hidden sm:mx-0 sm:w-full sm:rounded-3xl">
        <Image src={DASHBOARD_PHOTOS.learn} alt="" fill sizes="(min-width: 640px) 600px, 100vw" className="object-cover" priority />
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.coach.academyTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.coach.menuAcademyDescription}</p>
      </div>

      <div className="flex flex-col gap-5">
        {technicalCategoryRanges(technicalCount).map(({ key, start, end }) => {
          const topics = t.coach.topics.slice(start, end ?? t.coach.topics.length);
          return (
            <div key={key} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{t.coach.categoryLabels[key]}</h2>
              {topics.map((topic, i) => {
                const globalIndex = start + i;
                const Icon = TOPIC_ICONS[globalIndex % TOPIC_ICONS.length];
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
          );
        })}
      </div>
    </div>
  );
}
