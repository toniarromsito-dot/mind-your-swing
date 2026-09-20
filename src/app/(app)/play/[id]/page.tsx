import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/lib/require-user";
import { getGameForPlayer } from "@/lib/data/games";
import { GameLobby } from "@/components/game-lobby";
import { GameView } from "@/components/game-view";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";

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
    const totalPar = game.holes.reduce((sum, h) => sum + h.par, 0);
    return (
      <GameLobby
        gameId={game.id}
        course={game.course}
        layoutName={game.layoutName}
        teeName={game.teeName}
        totalHoles={game.holes.length}
        totalPar={totalPar}
        date={game.date.toISOString()}
        inviteCode={game.inviteCode}
        isSolo={game.mode === "SOLO"}
        playerCount={game.playerCount}
        players={game.players.map((p, i) => ({
          id: p.id,
          name: p.user.name ?? "Jugador",
          image: p.user.image,
          handicap: p.user.handicap,
          isCreator: i === 0,
        }))}
        modeLabel={t.newGame.modeLabels[game.mode]}
        bet={game.bet}
        t={t.lobby}
        playT={t.play}
        holesLabel={fmt(t.summary.holesTotal, { total: game.holes.length })}
        dateLocale={t.dateLocale}
        moodLabels={t.mood}
        moodCheckinT={t.moodCheckin}
      />
    );
  }

  return <GameView game={game} t={t.playGame} golfResult={t.golfResult} />;
}
