import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensurePlayerProfileForUser, recordTournamentResult } from "@/lib/data/players";

describe("ensurePlayerProfileForUser — Fase A, resolución User → PlayerProfile (integración, DB real)", () => {
  const userIds: string[] = [];
  const tournamentIds: string[] = [];

  afterAll(async () => {
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.playerProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(name: string | null) {
    const user = await prisma.user.create({
      data: { email: `ensure-profile-${Date.now()}-${Math.random()}@example.com`, name: name ?? undefined },
    });
    userIds.push(user.id);
    return user;
  }

  it("crea un PlayerProfile con nombre/apellidos separados a partir de User.name", async () => {
    const user = await makeUser("Carlos Pérez Ruiz");
    const profile = await ensurePlayerProfileForUser(user.id);
    expect(profile.firstName).toBe("Carlos");
    expect(profile.lastName).toBe("Pérez Ruiz");
    expect(profile.userId).toBe(user.id);
  });

  it("no duplica el PlayerProfile si ya existe — devuelve siempre la misma fila", async () => {
    const user = await makeUser("Marta Soto");
    const first = await ensurePlayerProfileForUser(user.id);
    const second = await ensurePlayerProfileForUser(user.id);
    expect(second.id).toBe(first.id);

    const all = await prisma.playerProfile.findMany({ where: { userId: user.id } });
    expect(all).toHaveLength(1);
  });

  it("lanza un error claro si el usuario no tiene nombre en su perfil", async () => {
    const user = await makeUser(null);
    await expect(ensurePlayerProfileForUser(user.id)).rejects.toThrow(
      "Añade tu nombre en el perfil antes de inscribirte en un torneo.",
    );
  });

  it("no confunde perfiles de dos usuarios distintos con el mismo nombre (sin matching débil)", async () => {
    const userA = await makeUser("Jorge Molina");
    const userB = await makeUser("Jorge Molina");

    const profileA = await ensurePlayerProfileForUser(userA.id);
    const profileB = await ensurePlayerProfileForUser(userB.id);

    expect(profileA.id).not.toBe(profileB.id);
    expect(profileA.userId).toBe(userA.id);
    expect(profileB.userId).toBe(userB.id);
  });

  it("recordTournamentResult crea el TournamentResult vinculado al participantId (no a playerProfileId directamente)", async () => {
    const user = await makeUser("Elena Vidal");
    const profile = await ensurePlayerProfileForUser(user.id);
    const tournament = await prisma.tournament.create({
      data: { name: "Torneo de prueba — resultado", course: "Campo de pruebas", date: new Date() },
    });
    tournamentIds.push(tournament.id);
    const participant = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: profile.id, identityConfidence: "PLAYER_CONFIRMED" },
    });

    const result = await recordTournamentResult({
      tournamentId: tournament.id,
      participantId: participant.id,
      strokes: 82,
      position: 3,
    });

    expect(result.participantId).toBe(participant.id);
    expect(result.strokes).toBe(82);
  });

  it("recordTournamentResult con newHandicap actualiza PlayerProfile.handicap y crea un HandicapEntry, sin tocar User.handicap", async () => {
    const user = await makeUser("Diego Ferrer");
    await prisma.user.update({ where: { id: user.id }, data: { handicap: 18 } });
    const profile = await ensurePlayerProfileForUser(user.id);
    const tournament = await prisma.tournament.create({
      data: { name: "Torneo de prueba — hándicap", course: "Campo de pruebas", date: new Date() },
    });
    tournamentIds.push(tournament.id);
    const participant = await prisma.tournamentParticipant.create({
      data: { tournamentId: tournament.id, playerProfileId: profile.id, identityConfidence: "PLAYER_CONFIRMED" },
    });

    await recordTournamentResult({
      tournamentId: tournament.id,
      participantId: participant.id,
      strokes: 79,
      newHandicap: 15.4,
    });

    const updatedProfile = await prisma.playerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(updatedProfile.handicap).toBe(15.4);

    const entries = await prisma.handicapEntry.findMany({ where: { playerId: profile.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].handicap).toBe(15.4);
    expect(entries[0].source).toBe(`torneo:${tournament.id}`);

    const unchangedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchangedUser.handicap).toBe(18); // User.handicap (casual) nunca lo toca el cierre de torneo
  });
});
