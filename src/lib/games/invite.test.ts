import { describe, expect, it } from "vitest";
import {
  buildInviteCourseLine,
  buildInviteFormatLine,
  buildInviteMessage,
  buildInviteUrl,
  buildWhatsAppShareUrl,
  joinPath,
  resolveJoinScreenState,
} from "./invite";

const STRINGS = {
  intro: "🏌️ Te invito a jugar en Mind Your Swing",
  holesLabel: "18 hoyos",
  joinLabel: "Únete aquí",
};

describe("joinPath / buildInviteUrl — test 1: generar enlace", () => {
  it("reutiliza el sistema de invitación existente: /play/join/[code], nunca un segundo mecanismo", () => {
    expect(joinPath("ABC123")).toBe("/play/join/ABC123");
  });

  it("codifica el código para que sea seguro como segmento de URL", () => {
    expect(joinPath("a b/c")).toBe("/play/join/a%20b%2Fc");
  });

  it("el enlace completo es origen + joinPath, exactamente el ejemplo del brief", () => {
    expect(buildInviteUrl("https://mind-your-swing.vercel.app", "ABC123")).toBe(
      "https://mind-your-swing.vercel.app/play/join/ABC123"
    );
  });
});

describe("buildInviteMessage — test 11: generación del mensaje de WhatsApp", () => {
  it("el ejemplo exacto del brief: campo + recorrido, hoyos + tee, enlace", () => {
    const message = buildInviteMessage(
      { course: "Golf Santa Ponsa", layoutName: "Santa Ponsa II", teeName: "Blancas" },
      "https://mind-your-swing.vercel.app/play/join/ABC123",
      STRINGS
    );
    expect(message).toBe(
      "🏌️ Te invito a jugar en Mind Your Swing\n" +
        "Golf Santa Ponsa · Santa Ponsa II\n" +
        "18 hoyos · Blancas\n" +
        "Únete aquí: https://mind-your-swing.vercel.app/play/join/ABC123"
    );
  });

  it("sin recorrido ni tee guardados (campo en texto libre): solo el nombre del campo y los hoyos, sin '· null'", () => {
    const message = buildInviteMessage(
      { course: "Campo municipal", layoutName: null, teeName: null },
      "https://mind-your-swing.vercel.app/play/join/XYZ789",
      STRINGS
    );
    expect(message).toBe(
      "🏌️ Te invito a jugar en Mind Your Swing\n" +
        "Campo municipal\n" +
        "18 hoyos\n" +
        "Únete aquí: https://mind-your-swing.vercel.app/play/join/XYZ789"
    );
  });

  it("con recorrido pero sin tee: la línea de formato es solo los hoyos", () => {
    expect(buildInviteFormatLine({ teeName: null }, "9 hoyos")).toBe("9 hoyos");
    expect(buildInviteFormatLine({ teeName: "AMARILLAS" }, "9 hoyos")).toBe("9 hoyos · AMARILLAS");
  });

  it("con campo pero sin recorrido: la línea de campo es solo el nombre del campo", () => {
    expect(buildInviteCourseLine({ course: "Golf Alcanada", layoutName: null })).toBe("Golf Alcanada");
    expect(buildInviteCourseLine({ course: "Golf Alcanada", layoutName: "Alcanada" })).toBe("Golf Alcanada · Alcanada");
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("codifica el mensaje completo (incluidos saltos de línea) en la URL de wa.me — sin API de WhatsApp", () => {
    const url = buildWhatsAppShareUrl("línea 1\nlínea 2");
    expect(url).toBe("https://wa.me/?text=l%C3%ADnea%201%0Al%C3%ADnea%202");
  });
});

describe("resolveJoinScreenState — tests 3/5/9: enlace inválido, usuario no autenticado, usuario ya unido", () => {
  it("test 3: código sin partida asociada -> not-found", () => {
    const state = resolveJoinScreenState({ preview: null, userId: null, alreadyJoined: false });
    expect(state).toEqual({ kind: "not-found" });
  });

  it("test 9: usuario autenticado que ya es GamePlayer -> already-joined, con el id de la partida", () => {
    const state = resolveJoinScreenState({
      preview: { id: "game-1", playerCount: 4, joinedCount: 2 },
      userId: "user-1",
      alreadyJoined: true,
    });
    expect(state).toEqual({ kind: "already-joined", gameId: "game-1" });
  });

  it("partida completa (independientemente de si hay sesión) -> full", () => {
    const full = { id: "game-1", playerCount: 2, joinedCount: 2 };
    expect(resolveJoinScreenState({ preview: full, userId: null, alreadyJoined: false })).toEqual({ kind: "full" });
    expect(resolveJoinScreenState({ preview: full, userId: "user-2", alreadyJoined: false })).toEqual({ kind: "full" });
  });

  it("test 5: partida con hueco y sin sesión -> needs-auth", () => {
    const state = resolveJoinScreenState({
      preview: { id: "game-1", playerCount: 4, joinedCount: 1 },
      userId: null,
      alreadyJoined: false,
    });
    expect(state).toEqual({ kind: "needs-auth" });
  });

  it("test 4: partida con hueco, autenticado y sin unirse todavía -> joinable", () => {
    const state = resolveJoinScreenState({
      preview: { id: "game-1", playerCount: 4, joinedCount: 1 },
      userId: "user-2",
      alreadyJoined: false,
    });
    expect(state).toEqual({ kind: "joinable" });
  });

  it("la comprobación de completa tiene prioridad sobre already-joined solo cuando alreadyJoined es false (un jugador ya dentro nunca ve 'partida completa')", () => {
    const state = resolveJoinScreenState({
      preview: { id: "game-1", playerCount: 2, joinedCount: 2 },
      userId: "user-1",
      alreadyJoined: true,
    });
    expect(state).toEqual({ kind: "already-joined", gameId: "game-1" });
  });
});
