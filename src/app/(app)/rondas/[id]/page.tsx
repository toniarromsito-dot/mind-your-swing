import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/lib/require-user";
import { getMessagesForRound, getRoundForUser } from "@/lib/data/rounds";
import { RoundView } from "@/components/round-view";
import { getDictionary } from "@/lib/i18n/current-locale";

export default async function RoundPage({ params }: PageProps<"/rondas/[id]">) {
  const { id } = await params;
  const userId = await requireUserId();

  const round = await getRoundForUser(id, userId);
  if (!round) notFound();

  if (round.status === "COMPLETED") {
    redirect(`/rondas/${id}/resumen`);
  }

  const messages = await getMessagesForRound(id);
  const { t } = await getDictionary();

  return (
    <RoundView
      round={round}
      initialMessages={messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
      t={t.round}
      moodLabels={t.mood}
      golfLabels={t.golfResult}
      chatT={t.chat}
      quickPrompts={t.quickPrompts}
    />
  );
}
