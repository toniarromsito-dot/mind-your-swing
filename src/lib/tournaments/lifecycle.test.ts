import { describe, expect, it } from "vitest";
import { isValidParticipantTransition, isValidTournamentTransition } from "./lifecycle";

describe("isValidTournamentTransition", () => {
  it("permite las transiciones esperadas del lifecycle", () => {
    expect(isValidTournamentTransition("DRAFT", "REGISTRATION_OPEN")).toBe(true);
    expect(isValidTournamentTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(isValidTournamentTransition("REGISTRATION_OPEN", "IN_PROGRESS")).toBe(true);
    expect(isValidTournamentTransition("REGISTRATION_OPEN", "CANCELLED")).toBe(true);
    expect(isValidTournamentTransition("IN_PROGRESS", "FINISHED")).toBe(true);
    expect(isValidTournamentTransition("IN_PROGRESS", "CANCELLED")).toBe(true);
  });

  it("rechaza saltos que se saltan el lifecycle", () => {
    expect(isValidTournamentTransition("DRAFT", "IN_PROGRESS")).toBe(false);
    expect(isValidTournamentTransition("DRAFT", "FINISHED")).toBe(false);
    expect(isValidTournamentTransition("REGISTRATION_OPEN", "FINISHED")).toBe(false);
    expect(isValidTournamentTransition("REGISTRATION_OPEN", "DRAFT")).toBe(false);
  });

  it("los estados terminales (FINISHED/CANCELLED) no tienen ninguna transición válida", () => {
    for (const to of ["DRAFT", "REGISTRATION_OPEN", "IN_PROGRESS", "FINISHED", "CANCELLED"] as const) {
      expect(isValidTournamentTransition("FINISHED", to)).toBe(false);
      expect(isValidTournamentTransition("CANCELLED", to)).toBe(false);
    }
  });
});

describe("isValidParticipantTransition", () => {
  it("permite las transiciones esperadas", () => {
    expect(isValidParticipantTransition("REGISTERED", "CANCELLED")).toBe(true);
    expect(isValidParticipantTransition("REGISTERED", "NO_SHOW")).toBe(true);
    expect(isValidParticipantTransition("REGISTERED", "REMOVED")).toBe(true);
    expect(isValidParticipantTransition("CANCELLED", "REGISTERED")).toBe(true);
    expect(isValidParticipantTransition("NO_SHOW", "REGISTERED")).toBe(true);
    expect(isValidParticipantTransition("REMOVED", "REGISTERED")).toBe(true);
  });

  it("rechaza una transición al mismo estado", () => {
    expect(isValidParticipantTransition("REGISTERED", "REGISTERED")).toBe(false);
    expect(isValidParticipantTransition("CANCELLED", "CANCELLED")).toBe(false);
  });

  it("rechaza transiciones no contempladas", () => {
    expect(isValidParticipantTransition("CANCELLED", "NO_SHOW")).toBe(false);
    expect(isValidParticipantTransition("NO_SHOW", "CANCELLED")).toBe(false);
  });
});
