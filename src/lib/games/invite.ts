/**
 * Invitar jugadores desde la app: construcción del enlace de invitación,
 * del mensaje de WhatsApp/compartir, y la máquina de estados de la
 * pantalla de unirse — todo en funciones puras, sin acceso a red/DB, para
 * poder testearlas directamente. Reutiliza el sistema de invitación ya
 * existente (Game.inviteCode + /play/join/[code]) — no se inventa un
 * segundo mecanismo.
 */

/**
 * Ruta de la pantalla de unirse a una partida — la misma para el enlace de
 * invitación que se comparte y para el callbackUrl del login, así el
 * invitado nunca pierde la invitación al pasar por autenticación (ver
 * signInWithGoogleAndRedirect).
 */
export function joinPath(inviteCode: string): string {
  return `/play/join/${encodeURIComponent(inviteCode)}`;
}

/** Enlace completo de invitación (origen + joinPath) — lo que se comparte por WhatsApp/enlace/copiar. */
export function buildInviteUrl(origin: string, inviteCode: string): string {
  return `${origin}${joinPath(inviteCode)}`;
}

export type InviteMessageGame = {
  course: string;
  layoutName: string | null;
  teeName: string | null;
};

export type InviteMessageStrings = {
  /** p. ej. "🏌️ Te invito a jugar en Mind Your Swing". */
  intro: string;
  /** Número de hoyos ya resuelto, p. ej. "18 hoyos" (ver fmt(t.summary.holesTotal, ...)). */
  holesLabel: string;
  /** p. ej. "Únete aquí". */
  joinLabel: string;
};

/** "Golf Santa Ponsa · Santa Ponsa II", o solo "Golf Santa Ponsa" si la partida no tiene recorrido guardado (campo en texto libre). */
export function buildInviteCourseLine(game: Pick<InviteMessageGame, "course" | "layoutName">): string {
  return game.layoutName ? `${game.course} · ${game.layoutName}` : game.course;
}

/** "18 hoyos · Blancas", o solo "18 hoyos" si la partida no tiene tee guardado. */
export function buildInviteFormatLine(game: Pick<InviteMessageGame, "teeName">, holesLabel: string): string {
  return game.teeName ? `${holesLabel} · ${game.teeName}` : holesLabel;
}

/** Mensaje completo de WhatsApp/compartir: intro, campo+recorrido, hoyos+tee, enlace — en ese orden, una línea cada uno. */
export function buildInviteMessage(game: InviteMessageGame, url: string, t: InviteMessageStrings): string {
  return [
    t.intro,
    buildInviteCourseLine(game),
    buildInviteFormatLine(game, t.holesLabel),
    `${t.joinLabel}: ${url}`,
  ].join("\n");
}

/** URL de wa.me con el mensaje ya codificado — mecanismo de enlace estándar de WhatsApp, sin necesidad de su API. */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Estado de la pantalla de unirse a una partida — decide qué mostrar antes
 * de renderizar nada, para poder testear la lógica sin DB ni React:
 * - "not-found": el código no corresponde a ninguna partida.
 * - "already-joined": el usuario autenticado ya es GamePlayer de esta
 *   partida — la página redirige directamente a /play/[id], no hay pantalla.
 * - "full": la partida ya tiene tantos GamePlayer como playerCount.
 * - "needs-auth": la partida existe y tiene hueco, pero no hay sesión.
 * - "joinable": la partida existe, tiene hueco y el usuario puede unirse ya.
 */
export type JoinScreenState =
  | { kind: "not-found" }
  | { kind: "already-joined"; gameId: string }
  | { kind: "full" }
  | { kind: "needs-auth" }
  | { kind: "joinable" };

export function resolveJoinScreenState(input: {
  preview: { id: string; playerCount: number; joinedCount: number } | null;
  userId: string | null;
  alreadyJoined: boolean;
}): JoinScreenState {
  if (!input.preview) return { kind: "not-found" };
  if (input.userId && input.alreadyJoined) return { kind: "already-joined", gameId: input.preview.id };
  if (input.preview.joinedCount >= input.preview.playerCount) return { kind: "full" };
  if (!input.userId) return { kind: "needs-auth" };
  return { kind: "joinable" };
}
