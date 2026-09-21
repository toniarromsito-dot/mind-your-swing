import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { listMyTournaments, listPastTournaments, listUpcomingTournaments } from "@/lib/data/tournaments";
import { TournamentRegisterButton } from "@/components/tournament-register-button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TOURNAMENT_PHOTOS = [DASHBOARD_PHOTOS.play, DASHBOARD_PHOTOS.community, DASHBOARD_PHOTOS.learn];

const PILL_TAB_TRIGGER_CLASS =
  "h-auto flex-none rounded-full border-none px-4 py-2 text-sm font-medium text-foreground/70 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none active:bg-secondary/60 dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground";

type TournamentForCard = {
  id: string;
  name: string;
  course: string;
  date: Date;
  format: string | null;
  registrations: { userId: string }[];
  results: { position: number | null; resultLabel: string | null; player: { firstName: string; lastName: string } }[];
};

function TournamentCard({
  tournament,
  index,
  viewerId,
  t,
  dateLocale,
  showRegister,
  showResults,
}: {
  tournament: TournamentForCard;
  index: number;
  viewerId: string;
  t: Dictionary["tournaments"];
  dateLocale: string;
  showRegister: boolean;
  showResults: boolean;
}) {
  const isRegistered = tournament.registrations.some((r) => r.userId === viewerId);
  const photo = TOURNAMENT_PHOTOS[index % TOURNAMENT_PHOTOS.length];

  return (
    <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
      <div className="flex items-center gap-4 p-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl">
          <Image src={photo} alt="" fill sizes="56px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-semibold">{tournament.name}</p>
          <p className="truncate text-xs text-muted-foreground">{tournament.course}</p>
          <p className="text-xs text-muted-foreground">
            {tournament.date.toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
            {tournament.format && ` · ${tournament.format}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            {fmt(t.participants, { n: tournament.registrations.length })}
          </p>
        </div>
        {showRegister && (
          <TournamentRegisterButton tournamentId={tournament.id} initiallyRegistered={isRegistered} t={t} />
        )}
      </div>

      {showResults && (
        <div className="flex flex-col gap-1.5 border-t border-border/50 px-4 pt-3 pb-4">
          {tournament.results.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.emptyResults}</p>
          ) : (
            tournament.results.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{r.position ?? "—"}.</span>
                  {r.player.firstName} {r.player.lastName}
                </span>
                {r.resultLabel && <span className="text-xs text-muted-foreground">{r.resultLabel}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default async function TournamentsPage() {
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const [upcoming, mine, past] = await Promise.all([
    listUpcomingTournaments(),
    listMyTournaments(userId),
    listPastTournaments(),
  ]);

  function renderList(list: TournamentForCard[], emptyText: string, opts: { showRegister: boolean; showResults: boolean }) {
    if (list.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {list.map((tournament, i) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            index={i}
            viewerId={userId}
            t={t.tournaments}
            dateLocale={t.dateLocale}
            showRegister={opts.showRegister}
            showResults={opts.showResults}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
      <div>
        <Link
          href="/community"
          aria-label={t.tournaments.backToCommunity}
          className="flex size-9 w-fit shrink-0 items-center justify-center rounded-full bg-secondary text-foreground active:bg-secondary/70"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">{t.tournaments.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.tournaments.subtitle}</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList className="h-auto w-fit gap-2 rounded-full bg-transparent p-0 group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="upcoming" className={PILL_TAB_TRIGGER_CLASS}>
            {t.tournaments.tabUpcoming}
          </TabsTrigger>
          <TabsTrigger value="mine" className={PILL_TAB_TRIGGER_CLASS}>
            {t.tournaments.tabMine}
          </TabsTrigger>
          <TabsTrigger value="results" className={PILL_TAB_TRIGGER_CLASS}>
            {t.tournaments.tabResults}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {renderList(upcoming, t.tournaments.emptyUpcoming, { showRegister: true, showResults: false })}
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          {renderList(mine, t.tournaments.emptyMine, { showRegister: true, showResults: false })}
        </TabsContent>
        <TabsContent value="results" className="mt-4">
          {renderList(past, t.tournaments.emptyResults, { showRegister: false, showResults: true })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
