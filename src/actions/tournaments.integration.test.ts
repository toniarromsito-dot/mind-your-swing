import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

let sessionUser: { id: string; email: string | null } | null = null;
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (sessionUser ? { user: sessionUser } : null)) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  registerForTournament,
  unregisterFromTournament,
  updateTournamentStatus,
  addParticipant,
  setParticipantStatus,
  claimParticipant,
  rematchParticipant,
} = await import("@/actions/tournaments");

describe("registerForTournament / unregisterFromTournament — Fase A, TournamentParticipant (integración, DB real)", () => {
  const createdTournamentIds: string[] = [];
  let userId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `tournament-participant-${Date.now()}@example.com`, name: "Ana García" },
    });
    userId = user.id;
    sessionUser = { id: userId, email: user.email };
  });

  afterAll(async () => {
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: createdTournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: createdTournamentIds } } });
    await prisma.playerProfile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  async function makeTournament(name: string, status: "DRAFT" | "REGISTRATION_OPEN" | "IN_PROGRESS" | "FINISHED" | "CANCELLED" = "REGISTRATION_OPEN") {
    const tournament = await prisma.tournament.create({
      data: { name, course: "Campo de pruebas", date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status },
    });
    createdTournamentIds.push(tournament.id);
    return tournament;
  }

  it("crea un TournamentParticipant REGISTERED con identityConfidence PLAYER_CONFIRMED al autoinscribirse en un torneo REGISTRATION_OPEN", async () => {
    const tournament = await makeTournament("Torneo de prueba — creación");

    await registerForTournament(tournament.id);

    const playerProfile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
    const participant = await prisma.tournamentParticipant.findUniqueOrThrow({
      where: { tournamentId_playerProfileId: { tournamentId: tournament.id, playerProfileId: playerProfile.id } },
    });
    expect(participant.status).toBe("REGISTERED");
    expect(participant.identityConfidence).toBe("PLAYER_CONFIRMED");
  });

  it.each(["DRAFT", "IN_PROGRESS", "FINISHED", "CANCELLED"] as const)(
    "rechaza la autoinscripción cuando el torneo está %s",
    async (status) => {
      const tournament = await makeTournament(`Torneo de prueba — rechazo ${status}`, status);
      await expect(registerForTournament(tournament.id)).rejects.toThrow();

      const playerProfile = await prisma.playerProfile.findUnique({ where: { userId } });
      if (playerProfile) {
        const participant = await prisma.tournamentParticipant.findUnique({
          where: { tournamentId_playerProfileId: { tournamentId: tournament.id, playerProfileId: playerProfile.id } },
        });
        expect(participant).toBeNull();
      }
    }
  );

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

  it("un NO_SHOW no puede reactivarse por autoservicio, aunque el torneo siga REGISTRATION_OPEN", async () => {
    const tournament = await makeTournament("Torneo de prueba — no_show bloqueado");
    await registerForTournament(tournament.id);
    const playerProfile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId } });
    const participant = await prisma.tournamentParticipant.findUniqueOrThrow({
      where: { tournamentId_playerProfileId: { tournamentId: tournament.id, playerProfileId: playerProfile.id } },
    });
    await prisma.tournamentParticipant.update({ where: { id: participant.id }, data: { status: "NO_SHOW" } });

    await expect(registerForTournament(tournament.id)).rejects.toThrow();

    const stillNoShow = await prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(stillNoShow.status).toBe("NO_SHOW");
  });
});

describe("Fase B — lifecycle, permisos, participantes, claim/rematch (integración, DB real)", () => {
  const tournamentIds: string[] = [];
  const userIds: string[] = [];
  const playerProfileIds: string[] = [];
  const ADMIN_EMAIL = `fase-b-admin-${Date.now()}@example.com`;
  const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

  let organizer: { id: string; email: string | null };
  let admin: { id: string; email: string | null };
  let outsider: { id: string; email: string | null };
  let claimant: { id: string; email: string | null };

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;

    const [organizerUser, adminUser, outsiderUser, claimantUser] = await Promise.all([
      prisma.user.create({ data: { email: `fase-b-organizer-${Date.now()}@example.com`, name: "Org Anizador" } }),
      prisma.user.create({ data: { email: ADMIN_EMAIL, name: "Admin Plataforma" } }),
      prisma.user.create({ data: { email: `fase-b-outsider-${Date.now()}@example.com`, name: "Usuario Normal" } }),
      prisma.user.create({ data: { email: `fase-b-claimant-${Date.now()}@example.com`, name: "Jugador Reclamante" } }),
    ]);
    userIds.push(organizerUser.id, adminUser.id, outsiderUser.id, claimantUser.id);
    organizer = { id: organizerUser.id, email: organizerUser.email };
    admin = { id: adminUser.id, email: adminUser.email };
    outsider = { id: outsiderUser.id, email: outsiderUser.email };
    claimant = { id: claimantUser.id, email: claimantUser.email };
  });

  afterAll(async () => {
    await prisma.tournamentResult.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournamentParticipant.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.playerProfile.deleteMany({ where: { id: { in: playerProfileIds } } });
    await prisma.playerProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
    await prisma.$disconnect();
  });

  afterEach(() => {
    sessionUser = null;
  });

  async function makeTournament(status: "DRAFT" | "REGISTRATION_OPEN" | "IN_PROGRESS" | "FINISHED" | "CANCELLED" = "DRAFT") {
    const tournament = await prisma.tournament.create({
      data: {
        name: `Torneo Fase B — ${Date.now()}-${Math.random()}`,
        course: "Campo de pruebas",
        date: new Date(),
        status,
        organizerId: organizer.id,
      },
    });
    tournamentIds.push(tournament.id);
    return tournament;
  }

  async function makePlayerProfile(suffix: string) {
    const profile = await prisma.playerProfile.create({ data: { firstName: "Jugador", lastName: `B ${suffix}` } });
    playerProfileIds.push(profile.id);
    return profile;
  }

  describe("updateTournamentStatus — lifecycle", () => {
    it("el organizer puede aplicar una transición válida (DRAFT -> REGISTRATION_OPEN)", async () => {
      const tournament = await makeTournament("DRAFT");
      sessionUser = organizer;
      await updateTournamentStatus(tournament.id, "REGISTRATION_OPEN");
      const updated = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
      expect(updated.status).toBe("REGISTRATION_OPEN");
    });

    it("rechaza una transición inválida (DRAFT -> IN_PROGRESS)", async () => {
      const tournament = await makeTournament("DRAFT");
      sessionUser = organizer;
      await expect(updateTournamentStatus(tournament.id, "IN_PROGRESS")).rejects.toThrow();
      const updated = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
      expect(updated.status).toBe("DRAFT");
    });

    it("un usuario sin permiso no puede cambiar el estado", async () => {
      const tournament = await makeTournament("DRAFT");
      sessionUser = outsider;
      await expect(updateTournamentStatus(tournament.id, "REGISTRATION_OPEN")).rejects.toThrow();
      const updated = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
      expect(updated.status).toBe("DRAFT");
    });

    it("un platform admin puede cambiar el estado aunque no sea el organizer", async () => {
      const tournament = await makeTournament("REGISTRATION_OPEN");
      sessionUser = admin;
      await updateTournamentStatus(tournament.id, "IN_PROGRESS");
      const updated = await prisma.tournament.findUniqueOrThrow({ where: { id: tournament.id } });
      expect(updated.status).toBe("IN_PROGRESS");
    });
  });

  describe("addParticipant — carga por organizer", () => {
    it("el organizer puede cargar un participante nuevo (UNVERIFIED, sin User vinculado)", async () => {
      const tournament = await makeTournament("REGISTRATION_OPEN");
      sessionUser = organizer;
      const participant = await addParticipant(tournament.id, { firstName: "Marc", lastName: "Bonet", club: "Club Prueba" });
      playerProfileIds.push(participant.playerProfileId);

      expect(participant.status).toBe("REGISTERED");
      expect(participant.identityConfidence).toBe("UNVERIFIED");
      const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { id: participant.playerProfileId } });
      expect(profile.userId).toBeNull();
    });

    it("un usuario normal no puede cargar participantes", async () => {
      const tournament = await makeTournament("REGISTRATION_OPEN");
      sessionUser = outsider;
      await expect(
        addParticipant(tournament.id, { firstName: "Marc", lastName: "Bonet" })
      ).rejects.toThrow();
    });

    it("nombre + club NO produce un vínculo automático a un PlayerProfile existente con el mismo nombre", async () => {
      const tournament = await makeTournament("REGISTRATION_OPEN");
      const existing = await makePlayerProfile("duplicado");
      await prisma.playerProfile.update({ where: { id: existing.id }, data: { firstName: "Marc", lastName: "Bonet", club: "Club Prueba" } });

      sessionUser = organizer;
      const participant = await addParticipant(tournament.id, { firstName: "Marc", lastName: "Bonet", club: "Club Prueba" });
      playerProfileIds.push(participant.playerProfileId);

      expect(participant.playerProfileId).not.toBe(existing.id); // se creó un perfil nuevo, no se reutilizó el homónimo
    });

    it("acepta un playerProfileId explícito (elección explícita del organizer entre candidatos)", async () => {
      const tournament = await makeTournament("REGISTRATION_OPEN");
      const existing = await makePlayerProfile("explicito");
      sessionUser = organizer;
      const participant = await addParticipant(tournament.id, {
        firstName: existing.firstName,
        lastName: existing.lastName,
        playerProfileId: existing.id,
      });
      expect(participant.playerProfileId).toBe(existing.id);
    });
  });

  describe("setParticipantStatus — estados del participante", () => {
    it("el organizer puede aplicar una transición válida (REGISTERED -> NO_SHOW)", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profile = await makePlayerProfile("status-1");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profile.id },
      });
      sessionUser = organizer;
      await setParticipantStatus(participant.id, "NO_SHOW");
      const updated = await prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: participant.id } });
      expect(updated.status).toBe("NO_SHOW");
    });

    it("rechaza una transición inválida (CANCELLED -> NO_SHOW)", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profile = await makePlayerProfile("status-2");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profile.id, status: "CANCELLED" },
      });
      sessionUser = organizer;
      await expect(setParticipantStatus(participant.id, "NO_SHOW")).rejects.toThrow();
    });

    it("un usuario normal no puede cambiar el estado de un participante", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profile = await makePlayerProfile("status-3");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profile.id },
      });
      sessionUser = outsider;
      await expect(setParticipantStatus(participant.id, "REMOVED")).rejects.toThrow();
    });
  });

  describe("claimParticipant — identificación del jugador", () => {
    it("el usuario puede reclamar un participante válido: vincula PlayerProfile, sube a PLAYER_CONFIRMED, registra matchedByUserId/matchedAt", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profile = await makePlayerProfile("claim-1");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profile.id },
      });

      sessionUser = claimant;
      await claimParticipant(participant.id);

      const updatedProfile = await prisma.playerProfile.findUniqueOrThrow({ where: { id: profile.id } });
      expect(updatedProfile.userId).toBe(claimant.id);
      const updatedParticipant = await prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: participant.id } });
      expect(updatedParticipant.identityConfidence).toBe("PLAYER_CONFIRMED");
      expect(updatedParticipant.matchedByUserId).toBe(claimant.id);
      expect(updatedParticipant.matchedAt).not.toBeNull();
    });

    it("nunca promociona a LICENSE_VERIFIED", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profile = await makePlayerProfile("claim-license");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profile.id },
      });
      sessionUser = { id: outsider.id, email: outsider.email }; // usuario cualquiera sin PlayerProfile propio todavía
      await claimParticipant(participant.id);
      const updated = await prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: participant.id } });
      expect(updated.identityConfidence).not.toBe("LICENSE_VERIFIED");
      expect(updated.identityConfidence).toBe("PLAYER_CONFIRMED");
    });

    it("rechaza reclamar un participante ya vinculado a otra cuenta", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profile = await makePlayerProfile("claim-2");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profile.id },
      });

      const firstClaimer = await prisma.user.create({ data: { email: `fase-b-claim2a-${Date.now()}@example.com`, name: "Primero" } });
      const secondClaimer = await prisma.user.create({ data: { email: `fase-b-claim2b-${Date.now()}@example.com`, name: "Segundo" } });
      userIds.push(firstClaimer.id, secondClaimer.id);

      sessionUser = { id: firstClaimer.id, email: firstClaimer.email };
      await claimParticipant(participant.id);

      sessionUser = { id: secondClaimer.id, email: secondClaimer.email };
      await expect(claimParticipant(participant.id)).rejects.toThrow();

      const updated = await prisma.playerProfile.findUniqueOrThrow({ where: { id: profile.id } });
      expect(updated.userId).toBe(firstClaimer.id); // el vínculo original no cambia
    });

    it("rechaza reclamar un segundo participante cuando el usuario ya tiene su propio PlayerProfile vinculado", async () => {
      const tournament1 = await makeTournament("IN_PROGRESS");
      const tournament2 = await makeTournament("IN_PROGRESS");
      const ownProfile = await makePlayerProfile("claim-own");
      const otherProfile = await makePlayerProfile("claim-other");
      const participantOwn = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament1.id, playerProfileId: ownProfile.id },
      });
      const participantOther = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament2.id, playerProfileId: otherProfile.id },
      });

      const user = await prisma.user.create({ data: { email: `fase-b-claim3-${Date.now()}@example.com`, name: "Ya Vinculado" } });
      userIds.push(user.id);
      sessionUser = { id: user.id, email: user.email };

      await claimParticipant(participantOwn.id); // primer claim, legítimo
      await expect(claimParticipant(participantOther.id)).rejects.toThrow(); // segundo claim, debe rechazarse

      const otherProfileAfter = await prisma.playerProfile.findUniqueOrThrow({ where: { id: otherProfile.id } });
      expect(otherProfileAfter.userId).toBeNull();
    });

    it("rechaza reclamar un participante que no está REGISTERED", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profile = await makePlayerProfile("claim-inactive");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profile.id, status: "REMOVED" },
      });

      const user = await prisma.user.create({ data: { email: `fase-b-claim4-${Date.now()}@example.com`, name: "Intento Inactivo" } });
      userIds.push(user.id);
      sessionUser = { id: user.id, email: user.email };

      await expect(claimParticipant(participant.id)).rejects.toThrow();
    });
  });

  describe("rematchParticipant — corrección por organizer/admin", () => {
    it("el organizer puede rematchear un participante a otro PlayerProfile, reseteando identityConfidence y actualizando trazabilidad", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const wrongProfile = await makePlayerProfile("rematch-wrong");
      const correctProfile = await makePlayerProfile("rematch-correct");
      const participant = await prisma.tournamentParticipant.create({
        data: {
          tournamentId: tournament.id,
          playerProfileId: wrongProfile.id,
          identityConfidence: "PLAYER_CONFIRMED",
        },
      });

      sessionUser = organizer;
      await rematchParticipant(participant.id, correctProfile.id);

      const updated = await prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: participant.id } });
      expect(updated.playerProfileId).toBe(correctProfile.id);
      expect(updated.identityConfidence).toBe("UNVERIFIED");
      expect(updated.matchedByUserId).toBe(organizer.id);
      expect(updated.matchedAt).not.toBeNull();
    });

    it("un admin puede rematchear aunque no sea el organizer", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const wrongProfile = await makePlayerProfile("rematch-admin-wrong");
      const correctProfile = await makePlayerProfile("rematch-admin-correct");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: wrongProfile.id },
      });

      sessionUser = admin;
      await rematchParticipant(participant.id, correctProfile.id);
      const updated = await prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: participant.id } });
      expect(updated.playerProfileId).toBe(correctProfile.id);
    });

    it("un usuario normal no puede rematchear", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const wrongProfile = await makePlayerProfile("rematch-outsider-wrong");
      const correctProfile = await makePlayerProfile("rematch-outsider-correct");
      const participant = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: wrongProfile.id },
      });

      sessionUser = outsider;
      await expect(rematchParticipant(participant.id, correctProfile.id)).rejects.toThrow();
      const unchanged = await prisma.tournamentParticipant.findUniqueOrThrow({ where: { id: participant.id } });
      expect(unchanged.playerProfileId).toBe(wrongProfile.id);
    });

    it("rechaza rematchear a un PlayerProfile que ya es participante del mismo torneo", async () => {
      const tournament = await makeTournament("IN_PROGRESS");
      const profileA = await makePlayerProfile("rematch-conflict-a");
      const profileB = await makePlayerProfile("rematch-conflict-b");
      const participantA = await prisma.tournamentParticipant.create({
        data: { tournamentId: tournament.id, playerProfileId: profileA.id },
      });
      await prisma.tournamentParticipant.create({ data: { tournamentId: tournament.id, playerProfileId: profileB.id } });

      sessionUser = organizer;
      await expect(rematchParticipant(participantA.id, profileB.id)).rejects.toThrow();
    });
  });
});
