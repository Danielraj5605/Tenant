import { describe, expect, it } from "vitest";
import { AwayPeriodInput, MemberEditInput, StaffInput } from "./inputs";

const id = "7d3c1a54-2f7e-4c11-9a0b-1f2e3d4c5b6a";

describe("AwayPeriodInput", () => {
  it("accepts a valid range and trims the reason", () => {
    const parsed = AwayPeriodInput.parse({
      memberId: id,
      startDate: "2026-11-14",
      endDate: "2026-11-15",
      fullDay: "true",
      reason: "  Home for the weekend ",
    });
    expect(parsed).toEqual({
      memberId: id,
      startDate: "2026-11-14",
      endDate: "2026-11-15",
      fullDay: true,
      reason: "Home for the weekend",
    });
  });

  it("treats a missing checkbox as a partial day and an empty reason as none", () => {
    const parsed = AwayPeriodInput.parse({ memberId: id, startDate: "2026-11-07", endDate: "2026-11-07", reason: "" });
    expect(parsed.fullDay).toBe(false);
    expect(parsed.reason).toBeNull();
  });

  it("rejects an end date before the start date", () => {
    const r = AwayPeriodInput.safeParse({ memberId: id, startDate: "2026-11-15", endDate: "2026-11-14" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["endDate"]);
  });

  it("rejects impossible dates and a missing member", () => {
    expect(AwayPeriodInput.safeParse({ memberId: id, startDate: "2027-02-29", endDate: "2027-03-01" }).success).toBe(false);
    expect(AwayPeriodInput.safeParse({ memberId: "", startDate: "2026-11-14", endDate: "2026-11-14" }).success).toBe(false);
  });

  it("caps the reason at 120 characters", () => {
    expect(
      AwayPeriodInput.safeParse({ memberId: id, startDate: "2026-11-14", endDate: "2026-11-14", reason: "x".repeat(121) })
        .success,
    ).toBe(false);
  });
});

describe("StaffInput", () => {
  it("accepts a cook or maid with a name", () => {
    expect(StaffInput.parse({ name: " Lakshmi ", role: "cook" })).toEqual({ name: "Lakshmi", role: "cook" });
    expect(StaffInput.safeParse({ name: "Meena", role: "maid" }).success).toBe(true);
  });

  it("refuses flatmates (they join by invite link)", () => {
    expect(StaffInput.safeParse({ name: "Arun", role: "flatmate" }).success).toBe(false);
  });
});

describe("MemberEditInput", () => {
  it("parses a rename and an optional leaving date", () => {
    expect(MemberEditInput.parse({ memberId: id, name: "Arun K", leftOn: "" })).toEqual({
      memberId: id,
      name: "Arun K",
      leftOn: null,
    });
    expect(MemberEditInput.parse({ memberId: id, name: "Arun", leftOn: "2026-12-31" }).leftOn).toBe("2026-12-31");
  });
});
