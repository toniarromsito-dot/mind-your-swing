import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/lib/require-user";
import { getGameForPlayer, getMessagesForGame } from "@/lib/data/games";
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

  const messages = await getMessagesForGame(id, userId);
  const { t } = await getDictionary();

  return (
    <GameView
      game={game}
      myUserId={userId}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
      t={t.playGame}
      moodLabels={t.mood}
      golfLabels={t.golfResult}
      standingsT={t.standings}
      chatT={t.chat}
      moodCheckinT={t.moodCheckin}
      quickPrompts={t.quickPrompts}
    />
  );
}
