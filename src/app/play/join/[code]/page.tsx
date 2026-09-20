import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGamePreviewByInviteCode } from "@/lib/data/games";
import { joinGame } from "@/actions/games";
import { signInWithGoogleAndRedirect } from "@/actions/auth";
import { joinPath, resolveJoinScreenState } from "@/lib/games/invite";
import { JoinInviteScreen } from "@/components/join-invite-screen";
import { getDictionary } from "@/lib/i18n/current-locale";
import { fmt } from "@/lib/i18n/format";

/**
 * Puerta de entrada de una invitación (WhatsApp, compartir, copiar
 * enlace) — deliberadamente FUERA del grupo (app): esa carpeta exige
 * sesión en su layout y envuelve todo en la barra de navegación completa,
 * lo que perdería la invitación de un invitado sin cuenta todavía y
 * mostraría el chrome de la app en lo que debe ser una pantalla mínima de
 * una sola acción. Mind Your Swing es la app; esta página es solo la
 * puerta de entrada — nunca una segunda versión de la app para navegador.
 *
 * Misma URL de siempre (/play/join/[code], Game.inviteCode) — no se
 * inventa un segundo sistema de invitación.
 */
export default async function JoinGamePage({ params }: PageProps<"/play/join/[code]">) {
  const { code } = await params;
  const { t } = await getDictionary();
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const preview = await getGamePreviewByInviteCode(code);

  const alreadyJoined = userId != null && preview != null
    ? Boolean(await prisma.gamePlayer.findUnique({ where: { gameId_userId: { gameId: preview.id, userId } }, select: { id: true } }))
    : false;

  const state = resolveJoinScreenState({
    preview: preview ? { id: preview.id, playerCount: preview.playerCount, joinedCount: preview._count.players } : null,
    userId,
    alreadyJoined,
  });

  if (state.kind === "not-found") {
    return <JoinInviteScreen variant="not-found" t={t.joinGame} />;
  }

  if (state.kind === "already-joined") {
    redirect(`/play/${state.gameId}`);
  }

  // preview no puede ser null aquí: "not-found" es el único estado que se
  // da cuando preview es null (ver resolveJoinScreenState).
  const hostName = preview!.players[0]?.user.name ?? null;
  const holesLabel = fmt(t.summary.holesTotal, { total: preview!.totalHoles });

  const sharedProps = {
    course: preview!.course,
    layoutName: preview!.layoutName,
    teeName: preview!.teeName,
    holesLabel,
    hostName,
    started: preview!.started,
    t: t.joinGame,
  } as const;

  if (state.kind === "full") {
    return <JoinInviteScreen variant="full" {...sharedProps} />;
  }

  if (state.kind === "needs-auth") {
    return (
      <JoinInviteScreen
        variant="needs-auth"
        {...sharedProps}
        loginAction={signInWithGoogleAndRedirect.bind(null, joinPath(code))}
      />
    );
  }

  return <JoinInviteScreen variant="joinable" {...sharedProps} joinAction={joinGame.bind(null, code)} />;
}
