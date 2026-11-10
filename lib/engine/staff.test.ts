import { describe, expect, it } from "vitest";
import { staffMonth, staffStatusOn, telHref } from "./staff";
import type { AwayPeriod, PresenceMember } from "./presence";

const mary: PresenceMember = { id: "mary", role: "cook", joined_on: "2026-10-01", left_on: null };
const off = (start: string, end: string): AwayPeriod => ({ member_id: "mary", start_date: start, end_date: end, full_day: true });
const part = (date: string, slots: AwayPeriod["slots"]): AwayPeriod => ({
  member_id: "mary",
  start_date: date,
  end_date: date,
  full_day: false,
  slots,
});

describe("staffMonth", () => {
  it("counts days worked so far, leave taken and leave ahead", () => {
    const periods = [off("2026-11-03", "2026-11-04"), part("2026-11-06", ["night"]), off("2026-11-20", "2026-11-20")];
    expect(staffMonth(mary, "2026-11", "2026-11-10", periods)).toEqual({
      daysSoFar: 10,
      workedSoFar: 8,
      fullDaysOff: 3,
      partDaysOff: 1,
      fullDaysOffAhead: 1,
    });
  });

  it("covers the whole month once it's over", () => {
    expect(staffMonth(mary, "2026-10", "2026-11-10", [])).toMatchObject({ daysSoFar: 31, workedSoFar: 31 });
  });

  it("only counts days they were employed", () => {
    const newCook = { ...mary, joined_on: "2026-11-08" };
    expect(staffMonth(newCook, "2026-11", "2026-11-10", [off("2026-11-01", "2026-11-09")])).toMatchObject({
      daysSoFar: 3,
      workedSoFar: 1,
      fullDaysOff: 2,
    });
  });

  it("ignores other people's leave and a future month has nothing so far", () => {
    const other: AwayPeriod = { ...off("2026-12-01", "2026-12-05"), member_id: "selvi" };
    expect(staffMonth(mary, "2026-12", "2026-11-10", [other])).toEqual({
      daysSoFar: 0,
      workedSoFar: 0,
      fullDaysOff: 0,
      partDaysOff: 0,
      fullDaysOffAhead: 0,
    });
  });
});

describe("staffStatusOn", () => {
  it("is working, off, or out for part of the day", () => {
    expect(staffStatusOn(mary, "2026-11-10", [])).toEqual({ kind: "working" });
    expect(staffStatusOn(mary, "2026-11-10", [off("2026-11-09", "2026-11-11")])).toEqual({ kind: "off" });
    expect(staffStatusOn(mary, "2026-11-10", [part("2026-11-10", ["morning"])])).toEqual({ kind: "part", slots: ["morning"] });
  });

  it("is not employed before joining or after leaving", () => {
    expect(staffStatusOn({ ...mary, left_on: "2026-11-01" }, "2026-11-10", [])).toEqual({ kind: "not_employed" });
  });
});

describe("telHref", () => {
  it("drops spaces and dashes", () => {
    expect(telHref("+91 98765-43210")).toBe("tel:+919876543210");
  });
});
