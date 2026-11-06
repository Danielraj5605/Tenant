import { describe, expect, it } from "vitest";
import { canEditAwayFor, canManageExpense, canMarkDuty } from "./permissions";

const admin = { id: "a", is_admin: true };
const madan = { id: "m", is_admin: false };
const barani = { id: "b", role: "flatmate" as const };
const self = { id: "m", role: "flatmate" as const };
const cook = { id: "c", role: "cook" as const };
const maid = { id: "s", role: "maid" as const };

describe("away days", () => {
  it("a flatmate can change their own away days", () => {
    expect(canEditAwayFor(madan, self)).toBe(true);
  });

  it("a flatmate can't change another flatmate's", () => {
    expect(canEditAwayFor(madan, barani)).toBe(false);
  });

  it("any flatmate can mark the cook's or maid's leave", () => {
    expect(canEditAwayFor(madan, cook)).toBe(true);
    expect(canEditAwayFor(madan, maid)).toBe(true);
  });

  it("the admin can change anyone's", () => {
    expect(canEditAwayFor(admin, barani)).toBe(true);
  });
});

describe("splits", () => {
  it("only the creator or the admin can manage a split", () => {
    expect(canManageExpense(madan, { created_by: "m" })).toBe(true);
    expect(canManageExpense(madan, { created_by: "b" })).toBe(false);
    expect(canManageExpense(admin, { created_by: "b" })).toBe(true);
  });
});

describe("duties", () => {
  it("only the person on duty or the admin can mark it", () => {
    expect(canMarkDuty(madan, { member_id: "m" })).toBe(true);
    expect(canMarkDuty(madan, { member_id: "b" })).toBe(false);
    expect(canMarkDuty(admin, { member_id: "b" })).toBe(true);
  });

  it("a skipped day (nobody on duty) can't be marked", () => {
    expect(canMarkDuty(admin, { member_id: null })).toBe(false);
  });
});
