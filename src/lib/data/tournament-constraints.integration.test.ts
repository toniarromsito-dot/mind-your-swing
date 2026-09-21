import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

/**
 * Fase A — pruebas a nivel de esquema/constraints (unicidad, defaults de
 * estado, external IDs) que no dependen de las server actions: crean filas
 * directamente con Prisma para verificar lo que la base de datos garantiza.
 */
describe("Fase A — constraints de esquema (integración, DB real)", () => {
  const tournamentIds: string[] = [];
  const playerProfileIds: string[] = [];

  afterAll(async () => {
    await prisma.tournamentResult.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.federationIdentity.deleteMany({ where: { playerProfileId: { in: playerProfileIds } } });
    await prisma.playerProfile.deleteMany({ where: { id: { in: playerProfileIds } } });
    await prisma.$disconnect();
  });

  async function makeTournament(overrides: Partial<Parameters<typeof prisma.tournament.create>[0]["data"]> = {}) {
    const tournament = await prisma.tournament.create({
      data: { name: `Torneo de prueba — ${Date.now()}-${Math.random()}`, course: "Campo de pruebas", date: new Date(), ...overrides },
    });
    tournamentIds.push(tournament.id);
    return tournament;
  }

  async function makePlayerProfile(suffix: string) {
    const profile = await prisma.playerProfile.create({
      data: { firstName: "Jugador", lastName: `Prueba ${suffix}` },
    });
    playerProfileIds.push(profile.id);
    return profile;
  }

  it("Tournament.status por defecto es DRAFT, y admite los 5 valores del enum", async () => {
    const tournament = await makeTournament();
    expect(tournament.status).toBe("DRAFT");

    for (const status of ["REGISTRATION_OPEN", "IN_PROGRESS", "FINISHED", "CANCELLED", "DRAFT"] as const) {
      const updated = await prisma.tournament.update({ where: { id: tournament.id }, data: { status } });
      expect(updated.status).toBe(status);
    }
  });

  it("TournamentParticipant.status por defecto es REGISTERED, y admite los 4 valores del enum", async () => {
    const tournament = await makeTournament();
    const profile = await makePlayerProfile("estado");
    const participant = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: profile.id },
    });
    expect(participant.status).toBe("REGISTERED");

    for (const status of ["CANCELLED", "NO_SHOW", "REMOVED", "REGISTERED"] as const) {
      const updated = await prisma.tournamentParticipant.update({ where: { id: participant.id }, data: { status } });
      expect(updated.status).toBe(status);
    }
  });

  it("TournamentParticipant.identityConfidence por defecto es UNVERIFIED", async () => {
    const tournament = await makeTournament();
    const profile = await makePlayerProfile("confianza");
    const participant = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: profile.id },
    });
    expect(participant.identityConfidence).toBe("UNVERIFIED");
  });

  it("no permite dos TournamentParticipant para el mismo (tournamentId, playerProfileId)", async () => {
    const tournament = await makeTournament();
    const profile = await makePlayerProfile("unicidad-directa");
    await prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: profile.id } });

    await expect(
      prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: profile.id } }),
    ).rejects.toThrow();
  });

  it("Tournament: externalProvider+externalId es idempotente — un segundo insert con el mismo par falla", async () => {
    await makeTournament({ source: "IMPORTED", externalProvider: "rfeg", externalId: "torneo-123" });

    await expect(
      makeTournament({ source: "IMPORTED", externalProvider: "rfeg", externalId: "torneo-123" }),
    ).rejects.toThrow();
  });

  it("Tournament: dos torneos MANUAL (externalProvider/externalId ambos NULL) conviven sin colisionar", async () => {
    await expect(Promise.all([makeTournament(), makeTournament()])).resolves.toBeDefined();
  });

  it("TournamentParticipant: externalParticipantId es único por torneo, pero se repite sin problema entre torneos distintos", async () => {
    const t1 = await makeTournament();
    const t2 = await makeTournament();
    const p1 = await makePlayerProfile("ext-1");
    const p2 = await makePlayerProfile("ext-2");
    const p3 = await makePlayerProfile("ext-3");

    await prisma.tournamentParticipant.create({
      data: { tournamentId: t1.id, playerProfileId: p1.id, externalParticipantId: "socio-42" },
    });

    await expect(
      prisma.tournamentParticipant.create({
        data: { tournamentId: t1.id, playerProfileId: p2.id, externalParticipantId: "socio-42" },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.tournamentParticipant.create({
        data: { tournamentId: t2.id, playerProfileId: p3.id, externalParticipantId: "socio-42" },
      }),
    ).resolves.toBeDefined();
  });

  it("TournamentParticipant: varios participantes sin externalParticipantId (NULL) conviven en el mismo torneo", async () => {
    const tournament = await makeTournament();
    const p1 = await makePlayerProfile("null-1");
    const p2 = await makePlayerProfile("null-2");

    await expect(
      Promise.all([
        prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: p1.id } }),
        prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: p2.id } }),
      ]),
    ).resolves.toBeDefined();
  });

  it("TournamentResult: externalResultId es único por torneo, y participantId es único por torneo", async () => {
    const tournament = await makeTournament();
    const p1 = await makePlayerProfile("result-1");
    const p2 = await makePlayerProfile("result-2");
    const participant1 = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: p1.id },
    });
    const participant2 = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: p2.id },
    });

    await prisma.tournamentResult.create({
      data: { tournamentId: tournament.id, participantId: participant1.id, externalResultId: "res-9" },
    });

    // mismo participantId en el mismo torneo → choca con @@unique([tournamentId, participantId])
    await expect(
      prisma.tournamentResult.create({ data: { tournamentId: tournament.id, participantId: participant1.id } }),
    ).rejects.toThrow();

    // mismo externalResultId en el mismo torneo → choca con @@unique([tournamentId, externalResultId])
    await expect(
      prisma.tournamentResult.create({
        data: { tournamentId: tournament.id, participantId: participant2.id, externalResultId: "res-9" },
      }),
    ).rejects.toThrow();
  });

  it("FederationIdentity: un mismo PlayerProfile no puede tener dos licencias de la misma federación", async () => {
    const profile = await makePlayerProfile("federacion-1");
    await prisma.federationIdentity.create({
      data: { playerProfileId: profile.id, federationProvider: "rfeg", licenseNumber: "LIC-001" },
    });

    await expect(
      prisma.federationIdentity.create({
        data: { playerProfileId: profile.id, federationProvider: "rfeg", licenseNumber: "LIC-002" },
      }),
    ).rejects.toThrow();
  });

  it("FederationIdentity: un número de licencia no puede pertenecer a dos PlayerProfile distintos dentro de la misma federación", async () => {
    const profileA = await makePlayerProfile("federacion-a");
    const profileB = await makePlayerProfile("federacion-b");
    await prisma.federationIdentity.create({
      data: { playerProfileId: profileA.id, federationProvider: "rfeg", licenseNumber: "LIC-777" },
    });

    await expect(
      prisma.federationIdentity.create({
        data: { playerProfileId: profileB.id, federationProvider: "rfeg", licenseNumber: "LIC-777" },
      }),
    ).rejects.toThrow();
  });

  it("FederationIdentity: el mismo licenseNumber sí puede repetirse en federaciones distintas", async () => {
    const profileA = await makePlayerProfile("federacion-c");
    const profileB = await makePlayerProfile("federacion-d");
    await prisma.federationIdentity.create({
      data: { playerProfileId: profileA.id, federationProvider: "rfeg", licenseNumber: "LIC-555" },
    });

    await expect(
      prisma.federationIdentity.create({
        data: { playerProfileId: profileB.id, federationProvider: "otra-federacion", licenseNumber: "LIC-555" },
      }),
    ).resolves.toBeDefined();
  });
});
