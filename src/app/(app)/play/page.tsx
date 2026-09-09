import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { requireUserId } from "@/lib/require-user";
import { listGamesForUser } from "@/lib/data/games";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toStandingsInput } from "@/lib/games/adapt";
import { computeStrokeStandings } from "@/lib/games/standings";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function PlayPage() {
  const userId = await requireUserId();
  const games = await listGamesForUser(userId);
  const { t } = await getDictionary();

  const active = games.filter((g) => g.status === "IN_PROGRESS");
  const completed = games.filter((g) => g.status === "COMPLETED");

  function GameRow({ game }: { game: (typeof games)[number] }) {
    const { players, scores } = toStandingsInput(game);
    const standings = computeStrokeStandings(players, scores);
    const me = standings.find((s) => game.players.find((p) => p.id === s.playerId)?.user.id === userId);

    return (
      <Link href={game.status === "COMPLETED" ? `/play/${game.id}/resumen` : `/play/${game.id}`}>
        <Card className="transition-colors hover:bg-secondary/40">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{game.course}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(game.date).toLocaleDateString(t.dateLocale, { day: "numeric", month: "short", year: "numeric" })}
                {game.players.length > 1 && ` · ${game.players.length} ${t.play.players}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {game.status === "IN_PROGRESS" && <Badge variant="secondary">{t.play.inProgress}</Badge>}
              {me && <span className="font-heading text-lg">{me.relativeToPar}</span>}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">{t.play.title}</h1>
        <Link href="/play/new" className={buttonVariants({ size: "sm", className: "gap-2" })}>
          <PlusCircle className="size-4" />
          {t.play.newGame}
        </Link>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t.play.tabActive}</TabsTrigger>
          <TabsTrigger value="history">{t.play.tabHistory}</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 flex flex-col gap-3">
          {active.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-muted-foreground">{t.play.noActiveGames}</p>
                <Link href="/play/new" className={buttonVariants({ size: "lg", className: "gap-2" })}>
                  <PlusCircle className="size-4" />
                  {t.play.newGame}
                </Link>
              </CardContent>
            </Card>
          ) : (
            active.map((g) => <GameRow key={g.id} game={g} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 flex flex-col gap-3">
          {completed.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.play.noHistory}</p>
          ) : (
            completed.map((g) => <GameRow key={g.id} game={g} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
