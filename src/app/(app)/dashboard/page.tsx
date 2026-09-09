import Link from "next/link";
import { auth } from "@/lib/auth";
import { requireUserId } from "@/lib/require-user";
import { getActiveGamesForUser } from "@/lib/data/games";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
import { Flag, Brain, Target, Sprout, ArrowRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function HomePage() {
  const userId = await requireUserId();
  const session = await auth();
  const { t } = await getDictionary();

  const activeGames = await getActiveGamesForUser(userId);
  const activeGame = activeGames[0] ?? null;

  const cards = [
    { href: "/play/new", emoji: "🏌️", icon: Flag, title: t.home.playCard, body: t.home.playCardBody },
    { href: "/mind", emoji: "🧠", icon: Brain, title: t.home.mindCard, body: t.home.mindCardBody },
    { href: "/coach/videos", emoji: "⛳", icon: Target, title: t.home.trainCard, body: t.home.trainCardBody },
    { href: "/coach", emoji: "🌱", icon: Sprout, title: t.home.learnCard, body: t.home.learnCardBody },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl">
          {t.dashboard.greeting(session?.user.name?.split(" ")[0] ?? "")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.home.prompt}</p>
      </div>

      {activeGame && (
        <Card className="border-primary/30 bg-secondary/40">
          <CardContent className="flex items-center justify-between gap-4 py-5">
            <div>
              <p className="text-xs font-medium text-primary">{t.home.gameInProgress}</p>
              <p className="mt-1 font-medium">{activeGame.course}</p>
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
                return me ? (
                  <p className="mt-1 text-sm font-medium">{me.relativeToPar}</p>
                ) : null;
              })()}
            </div>
            <Link href={`/play/${activeGame.id}`} className={buttonVariants({ className: "gap-1.5" })}>
              {t.home.continue} <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-colors hover:bg-secondary/40">
              <CardContent className="flex flex-col items-start gap-2 py-6">
                <span className="text-3xl">{c.emoji}</span>
                <p className="font-heading text-base">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
