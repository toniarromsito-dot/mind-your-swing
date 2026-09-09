import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/lib/require-user";
import { getGameByInviteCode } from "@/lib/data/games";
import { joinGame } from "@/actions/games";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";

export default async function JoinGamePage({ params }: PageProps<"/play/join/[code]">) {
  const { code } = await params;
  const userId = await requireUserId();
  const { t } = await getDictionary();

  const game = await getGameByInviteCode(code);
  if (!game) notFound();

  const alreadyIn = game.players.some((p) => p.user.id === userId);
  if (alreadyIn) redirect(`/play/${game.id}`);

  if (game.players.length >= game.playerCount) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
        <Users className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t.joinGame.full}</p>
      </div>
    );
  }

  const creatorName = game.players[0]?.user.name ?? "un jugador";
  const joinGameBound = joinGame.bind(null, code);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
      <Users className="size-8 text-primary" />
      <h1 className="font-heading text-xl">{fmt(t.joinGame.invite, { name: creatorName, course: game.course })}</h1>
      <p className="text-sm text-muted-foreground">
        {game.players.length}/{game.playerCount} {t.joinGame.playersJoined}
      </p>
      <form action={joinGameBound}>
        <Button type="submit" size="lg">
          {t.joinGame.join}
        </Button>
      </form>
    </div>
  );
}
