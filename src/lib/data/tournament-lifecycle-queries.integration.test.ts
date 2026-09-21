import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listClaimCandidates, listMyTournaments, listPastTournaments, listUpcomingTournaments } from "./tournaments";

/**
 * Fase B — decisión 8: los listados deben respetar Tournament.status, no
 * maquillar el problema filtrando solo por fecha. Un torneo por cada estado,
 * comprobando en qué listado(s) debería (o no) aparecer.
 */
describe("listUpcomingTournaments / listPastTournaments — respetan el lifecycle (integración, DB real)", () => {
  const tournamentIds: string[] = [];

  afterAll(async () => {
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.$disconnect();
  });

  async function makeTournament(name: string, status: "DRAFT" | "REGISTRATION_OPEN" | "IN_PROGRESS" | "FINISHED" | "CANCELLED") {
    const tournament = await prisma.tournament.create({
      data: { name, course: "Campo de pruebas", date: new Date(), status },
    });
    tournamentIds.push(tournament.id);
    return tournament;
  }

  it("DRAFT no aparece en Próximos ni en Resultados", async () => {
    const draft = await makeTournament("Lifecycle — draft", "DRAFT");
    const upcoming = await listUpcomingTournaments();
    const past = await listPastTournaments();
    expect(upcoming.some((t) => t.id === draft.id)).toBe(false);
    expect(past.some((t) => t.id === draft.id)).toBe(false);
  });

  it("CANCELLED no aparece en Próximos (no debe quedar abierto a inscripción)", async () => {
    const cancelled = await makeTournament("Lifecycle — cancelled", "CANCELLED");
    const upcoming = await listUpcomingTournaments();
    expect(upcoming.some((t) => t.id === cancelled.id)).toBe(false);
  });

  it("REGISTRATION_OPEN aparece en Próximos", async () => {
    const open = await makeTournament("Lifecycle — open", "REGISTRATION_OPEN");
    const upcoming = await listUpcomingTournaments();
    expect(upcoming.some((t) => t.id === open.id)).toBe(true);
  });

  it("IN_PROGRESS sigue siendo visible en Próximos", async () => {
    const inProgress = await makeTournament("Lifecycle — in progress", "IN_PROGRESS");
    const upcoming = await listUpcomingTournaments();
    expect(upcoming.some((t) => t.id === inProgress.id)).toBe(true);
  });

  it("FINISHED aparece únicamente en Resultados, no en Próximos", async () => {
    const finished = await makeTournament("Lifecycle — finished", "FINISHED");
    const upcoming = await listUpcomingTournaments();
    const past = await listPastTournaments();
    expect(upcoming.some((t) => t.id === finished.id)).toBe(false);
    expect(past.some((t) => t.id === finished.id)).toBe(true);
  });
});

describe("listMyTournaments — incluye cualquier estado de participación (integración, DB real)", () => {
  const tournamentIds: string[] = [];
  const playerProfileIds: string[] = [];
  let userId = "";

  afterAll(async () => {
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.playerProfile.deleteMany({ where: { id: { in: playerProfileIds } } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
  });

  it("muestra torneos donde el participante está CANCELLED/NO_SHOW/REMOVED, no solo REGISTERED", async () => {
    const user = await prisma.user.create({ data: { email: `my-tournaments-${Date.now()}@example.com`, name: "Vero Historial" } });
    userId = user.id;
    const profile = await prisma.playerProfile.create({ data: { userId, firstName: "Vero", lastName: "Historial" } });
    playerProfileIds.push(profile.id);

    const tournamentCancelled = await prisma.tournament.create({
      data: { name: "Mine — cancelled", course: "Campo", date: new Date(), status: "REGISTRATION_OPEN" },
    });
    const tournamentNoShow = await prisma.tournament.create({
      data: { name: "Mine — no show", course: "Campo", date: new Date(), status: "FINISHED" },
    });
    tournamentIds.push(tournamentCancelled.id, tournamentNoShow.id);

    await prisma.tournamentParticipant.create({
      data: { tournamentId: tournamentCancelled.id, playerProfileId: profile.id, status: "CANCELLED" },
    });
    await prisma.tournamentParticipant.create({
      data: { tournamentId: tournamentNoShow.id, playerProfileId: profile.id, status: "NO_SHOW" },
    });

    const mine = await listMyTournaments(userId);
    const ids = mine.map((t) => t.id);
    expect(ids).toContain(tournamentCancelled.id);
    expect(ids).toContain(tournamentNoShow.id);
  });
});

describe("listClaimCandidates — acotado al viewer, solo UNVERIFIED sin User vinculado (integración, DB real)", () => {
  const tournamentIds: string[] = [];
  const playerProfileIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.playerProfile.deleteMany({ where: { id: { in: playerProfileIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("excluye participantes ya vinculados a un User y los que no son UNVERIFIED, y solo muestra los que coinciden con el nombre del viewer", async () => {
    const tournament = await prisma.tournament.create({
      data: { name: "Claim candidates", course: "Campo", date: new Date(), status: "IN_PROGRESS" },
    });
    tournamentIds.push(tournament.id);

    const viewer = await prisma.user.create({ data: { email: `claim-viewer-${Date.now()}@example.com`, name: "Cándida To" } });
    const linkedUser = await prisma.user.create({ data: { email: `claim-linked-${Date.now()}@example.com`, name: "Ya Vinculado" } });
    userIds.push(viewer.id, linkedUser.id);

    const matchingUnverified = await prisma.playerProfile.create({ data: { firstName: "Cándida", lastName: "To" } });
    const linked = await prisma.playerProfile.create({ data: { firstName: "Ya", lastName: "Vinculado", userId: linkedUser.id } });
    const confirmedButUnlinkedName = await prisma.playerProfile.create({ data: { firstName: "Cándida", lastName: "Homónima" } });
    playerProfileIds.push(matchingUnverified.id, linked.id, confirmedButUnlinkedName.id);

    await prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: matchingUnverified.id } });
    await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: linked.id, identityConfidence: "UNVERIFIED" },
    });
    await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: confirmedButUnlinkedName.id, identityConfidence: "PLAYER_CONFIRMED" },
    });

    const candidates = await listClaimCandidates(tournament.id, viewer.id);
    const ids = candidates.map((c) => c.playerProfile.firstName + " " + c.playerProfile.lastName);
    expect(ids).toEqual(["Cándida To"]); // ni el ya vinculado, ni el PLAYER_CONFIRMED (aunque comparta nombre de pila)
  });

  it("no muestra ningún candidato a un viewer cuyo nombre no coincide con ninguno, aunque existan candidatos UNVERIFIED sin reclamar en el torneo", async () => {
    const tournament = await prisma.tournament.create({
      data: { name: "Claim candidates — sin match", course: "Campo", date: new Date(), status: "IN_PROGRESS" },
    });
    tournamentIds.push(tournament.id);

    const unrelatedViewer = await prisma.user.create({ data: { email: `claim-unrelated-${Date.now()}@example.com`, name: "Persona Distinta" } });
    userIds.push(unrelatedViewer.id);

    const someoneElse = await prisma.playerProfile.create({ data: { firstName: "Marc", lastName: "Bonet" } });
    playerProfileIds.push(someoneElse.id);
    await prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: someoneElse.id } });

    const candidates = await listClaimCandidates(tournament.id, unrelatedViewer.id);
    expect(candidates).toEqual([]);
  });

  it("no devuelve candidatos si el viewer no tiene nombre en su perfil (no se puede acotar, así que no se muestra nada)", async () => {
    const tournament = await prisma.tournament.create({
      data: { name: "Claim candidates — sin nombre", course: "Campo", date: new Date(), status: "IN_PROGRESS" },
    });
    tournamentIds.push(tournament.id);

    const namelessViewer = await prisma.user.create({ data: { email: `claim-nameless-${Date.now()}@example.com` } });
    userIds.push(namelessViewer.id);

    const someoneElse = await prisma.playerProfile.create({ data: { firstName: "Marc", lastName: "Bonet" } });
    playerProfileIds.push(someoneElse.id);
    await prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: someoneElse.id } });

    const candidates = await listClaimCandidates(tournament.id, namelessViewer.id);
    expect(candidates).toEqual([]);
  });
});
