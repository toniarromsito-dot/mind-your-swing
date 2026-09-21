import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

let userId = "";
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: userId } })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { registerForTournament, unregisterFromTournament } = await import("@/actions/tournaments");

describe("registerForTournament / unregisterFromTournament — Fase A, TournamentParticipant (integración, DB real)", () => {
  const createdTournamentIds: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `tournament-participant-${Date.now()}@example.com`, name: "Ana García" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: createdTournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: createdTournamentIds } } });
    await prisma.playerProfile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  async function makeTournament(name: string) {
    const tournament = await prisma.tournament.create({
      data: { name, course: "Campo de pruebas", date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    createdTournamentIds.push(tournament.id);
    return tournament;
  }

  it("crea un TournamentParticipant REGISTERED con identityConfidence PLAYER_CONFIRMED al autoinscribirse", async () => {
    const tournament = await makeTournament("Torneo de prueba — creación");

    await registerForTournament(tournament.id);

    const playerProfile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
    const participant = await prisma.tournamentParticipant.findUniqueOrThrow({
      where: { tournamentId_playerProfileId: { tournamentId: tournament.id, playerProfileId: playerProfile.id } },
    });
    expect(participant.status).toBe("REGISTERED");
    expect(participant.identityConfidence).toBe("PLAYER_CONFIRMED");
  });

  it("resuelve User → PlayerProfile creando uno solo la primera vez (sin duplicar) al inscribirse en dos torneos distintos", async () => {
    const t1 = await makeTournament("Torneo de prueba — perfil 1");
    const t2 = await makeTournament("Torneo de prueba — perfil 2");

    await registerForTournament(t1.id);
    await registerForTournament(t2.id);

    const profiles = await prisma.playerProfile.findMany({ where: { userId } });
    expect(profiles).toHaveLength(1);
    expect(profiles[0].firstName).toBe("Ana");
    expect(profiles[0].lastName).toBe("García");
  });

  it("no permite un segundo TournamentParticipant para el mismo (torneo, playerProfile) — inscribirse dos veces es idempotente", async () => {
    const tournament = await makeTournament("Torneo de prueba — unicidad");

    await registerForTournament(tournament.id);
    await registerForTournament(tournament.id); // segunda llamada, no debe crear una fila nueva ni fallar

    const playerProfile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
    const participants = await prisma.tournamentParticipant.findMany({
      where: { tournamentId: tournament.id, playerProfileId: playerProfile.id },
    });
    expect(participants).toHaveLength(1);
  });

  it("cancelar la inscripción actualiza el estado a CANCELLED sin borrar la fila, y volver a inscribirse la reactiva a REGISTERED", async () => {
    const tournament = await makeTournament("Torneo de prueba — cancelar y reactivar");

    await registerForTournament(tournament.id);
    await unregisterFromTournament(tournament.id);

    const playerProfile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
    const cancelled = await prisma.tournamentParticipant.findUniqueOrThrow({
      where: { tournamentId_playerProfileId: { tournamentId: tournament.id, playerProfileId: playerProfile.id } },
    });
    expect(cancelled.status).toBe("CANCELLED");

    await registerForTournament(tournament.id);
    const reactivated = await prisma.tournamentParticipant.findUniqueOrThrow({
      where: { tournamentId_playerProfileId: { tournamentId: tournament.id, playerProfileId: playerProfile.id } },
    });
    expect(reactivated.status).toBe("REGISTERED");
    expect(reactivated.id).toBe(cancelled.id); // misma fila, no una nueva
  });

  it("cancelar sin haberse inscrito nunca no lanza error (comportamiento equivalente al antiguo deleteMany silencioso)", async () => {
    const tournament = await makeTournament("Torneo de prueba — cancelar sin inscripción");
    await expect(unregisterFromTournament(tournament.id)).resolves.toBeUndefined();
  });
});
