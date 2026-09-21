import { afterEach, describe, expect, it } from "vitest";
import { canManageTournament } from "./permissions";

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;
const ORIGINAL_OWNER_EMAILS = process.env.OWNER_EMAILS;

afterEach(() => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
  process.env.OWNER_EMAILS = ORIGINAL_OWNER_EMAILS;
});

describe("canManageTournament", () => {
  it("permite al organizer del torneo", () => {
    expect(canManageTournament({ organizerId: "user-1" }, { id: "user-1", email: "user1@example.com" })).toBe(true);
  });

  it("rechaza a un usuario que no es organizer ni admin", () => {
    process.env.ADMIN_EMAILS = "";
    process.env.OWNER_EMAILS = "";
    expect(canManageTournament({ organizerId: "user-1" }, { id: "user-2", email: "user2@example.com" })).toBe(false);
  });

  it("rechaza cuando el torneo no tiene organizer y el usuario no es admin", () => {
    process.env.ADMIN_EMAILS = "";
    process.env.OWNER_EMAILS = "";
    expect(canManageTournament({ organizerId: null }, { id: "user-2", email: "user2@example.com" })).toBe(false);
  });

  it("permite a un platform admin aunque no sea el organizer", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(canManageTournament({ organizerId: "user-1" }, { id: "user-2", email: "admin@example.com" })).toBe(true);
  });

  it("permite a un owner (que también es admin) aunque no sea el organizer", () => {
    process.env.ADMIN_EMAILS = "";
    process.env.OWNER_EMAILS = "owner@example.com";
    expect(canManageTournament({ organizerId: "user-1" }, { id: "user-2", email: "owner@example.com" })).toBe(true);
  });
});
