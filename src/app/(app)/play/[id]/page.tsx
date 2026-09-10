import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/lib/require-user";
import { getGameForPlayer } from "@/lib/data/games";
import { GameLobby } from "@/components/game-lobby";
import { GameView } from "@/components/game-view";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function GamePage({ params }: PageProps<"/play/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();

  const game = await getGameForPlayer(id, userId);
  if (!game) notFound();

  if (game.status === "COMPLETED") {
    redirect(`/play/${id}/resumen`);
  }

  const { t } = await getDictionary();

  if (!game.started) {
    return (
      <GameLobby
        gameId={game.id}
        course={game.course}
        inviteCode={game.inviteCode}
        isSolo={game.mode === "SOLO"}
        playerCount={game.playerCount}
        players={game.players.map((p) => ({ id: p.id, name: p.user.name ?? "Jugador", image: p.user.image }))}
        bet={game.bet}
        t={t.lobby}
        moodLabels={t.mood}
        moodCheckinT={t.moodCheckin}
      />
    );
  }

  return <GameView game={game} t={t.playGame} golfResult={t.golfResult} />;
}
