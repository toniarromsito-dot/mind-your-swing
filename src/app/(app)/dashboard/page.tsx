import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getActiveGamesForUser } from "@/lib/data/games";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
import { Flag, Brain, GraduationCap, Users, ArrowRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();
  const h = t.home;

  const activeGames = await getActiveGamesForUser(userId);
  const activeGame = activeGames[0] ?? null;

  const cards = [
    { href: "/play/new", icon: Flag, title: h.playCard, body: h.playCardBody },
    { href: "/mind", icon: Brain, title: h.coachCard, body: h.coachCardBody },
    { href: "/coach", icon: GraduationCap, title: h.learnCard, body: h.learnCardBody },
    { href: "/community", icon: Users, title: h.communityCard, body: h.communityCardBody },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.dashboard.greeting(session?.user.name?.split(" ")[0] ?? "")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{h.prompt}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-colors hover:border-primary/30 hover:bg-secondary/40">
              <CardContent className="flex flex-col items-start gap-3 py-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <c.icon className="size-5" />
                </span>
                <p className="font-heading text-base font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {activeGame && (
        <Card className="border-primary/30 bg-secondary/40">
          <CardContent className="flex items-center justify-between gap-4 py-5">
            <div>
              <p className="text-xs font-medium tracking-wide text-primary uppercase">{h.nextRoundTitle}</p>
              <p className="mt-1 font-heading text-lg font-semibold">{activeGame.course}</p>
              <p className="text-sm text-muted-foreground">
                {activeGame.players.length > 1 ? `${activeGame.players.length} ${t.play.players} · ` : ""}
                {t.newGame.modeLabels[activeGame.mode]}
              </p>
              {(() => {
                const { players, scores } = toStandingsInput(activeGame);
                const standings = computeStrokeStandings(players, scores);
                const me = standings.find(
                  (s) => activeGame.players.find((p) => p.id === s.playerId)?.user.id === userId
                );
                return me ? <p className="mt-1 text-sm font-medium">{me.relativeToPar}</p> : null;
              })()}
            </div>
            <Link href={`/play/${activeGame.id}`} className={buttonVariants({ className: "gap-1.5 rounded-full" })}>
              {h.continue} <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
