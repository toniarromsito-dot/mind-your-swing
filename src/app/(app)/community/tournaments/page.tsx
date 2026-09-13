import Link from "next/link";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { listMyTournaments, listPastTournaments, listUpcomingTournaments } from "@/lib/data/tournaments";
import { TournamentRegisterButton } from "@/components/tournament-register-button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getDictionary } from "@/lib/i18n/current-locale";
import { DASHBOARD_PHOTOS } from "@/lib/dashboard-photos";
import { fmt } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const TOURNAMENT_PHOTOS = [DASHBOARD_PHOTOS.play, DASHBOARD_PHOTOS.community, DASHBOARD_PHOTOS.learn];

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
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 py-4">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
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
      </CardContent>

      {showResults && (
        <CardContent className="flex flex-col gap-1 border-t border-border/70 py-3">
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
        </CardContent>
      )}
    </Card>
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
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{emptyText}</CardContent>
        </Card>
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
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/community" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" />
          {t.tournaments.backToCommunity}
        </Link>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t.tournaments.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.tournaments.subtitle}</p>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">{t.tournaments.tabUpcoming}</TabsTrigger>
          <TabsTrigger value="mine">{t.tournaments.tabMine}</TabsTrigger>
          <TabsTrigger value="results">{t.tournaments.tabResults}</TabsTrigger>
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
