import { describe, expect, it } from "vitest";
import {
  awayOn,
  cookWorkedOn,
  headcount,
  isLongAway,
  isPresent,
  isPresentFor,
  slotsPhrase,
  type AwaySlot,
  returnDate,
  type AwayPeriod,
  type PresenceMember,
} from "./presence";

const flatmate = (id: string, extra: Partial<PresenceMember> = {}): PresenceMember => ({
  id,
  role: "flatmate",
  joined_on: "2026-01-01",
  left_on: null,
  ...extra,
});

const away = (
  member_id: string,
  start_date: string,
  end_date: string,
  full_day = true,
  slots: AwaySlot[] | null = null,
): AwayPeriod => ({ member_id, start_date, end_date, full_day, slots });

describe("isPresent (SPEC §5.1)", () => {
  // SPEC §12 case 7
  it("member away 14–15 Nov is absent on those dates and present on 13 and 16 Nov", () => {
    const m = flatmate("a");
    const periods = [away("a", "2026-11-14", "2026-11-15")];
    expect(isPresent(m, "2026-11-13", periods)).toBe(true);
    expect(isPresent(m, "2026-11-14", periods)).toBe(false);
    expect(isPresent(m, "2026-11-15", periods)).toBe(false);
    expect(isPresent(m, "2026-11-16", periods)).toBe(true);
  });

  it("is false before joined_on and after left_on", () => {
    const m = flatmate("a", { joined_on: "2026-11-10", left_on: "2026-11-20" });
    expect(isPresent(m, "2026-11-09", [])).toBe(false);
    expect(isPresent(m, "2026-11-10", [])).toBe(true);
    expect(isPresent(m, "2026-11-20", [])).toBe(true);
    expect(isPresent(m, "2026-11-21", [])).toBe(false);
  });

  it("ignores other members' away periods", () => {
    expect(isPresent(flatmate("a"), "2026-11-14", [away("b", "2026-11-14", "2026-11-15")])).toBe(true);
  });

  it("a part-day absence keeps them present for the day (chores and money)", () => {
    expect(isPresent(flatmate("a"), "2026-11-14", [away("a", "2026-11-14", "2026-11-14", false, ["night"])])).toBe(true);
  });

  // SPEC §12 case 10 (presence half; split rules arrive in Phase 4)
  it("long-away member (5 Nov – 5 Feb) is absent throughout and rejoins on 6 Feb", () => {
    const m = flatmate("f6");
    const periods = [away("f6", "2026-11-05", "2027-02-05")];
    expect(isPresent(m, "2026-11-05", periods)).toBe(false);
    expect(isPresent(m, "2026-12-25", periods)).toBe(false);
    expect(isPresent(m, "2027-02-05", periods)).toBe(false);
    expect(isPresent(m, "2027-02-06", periods)).toBe(true);
  });
});

describe("cookWorkedOn (SPEC §5.1 cook pay)", () => {
  const cook: PresenceMember = { id: "cook", role: "cook", joined_on: "2026-01-01", left_on: null };

  // SPEC §12 case 11
  it("full-day leave on 7 Nov → 7 Nov is not worked (unpaid)", () => {
    expect(cookWorkedOn(cook, "2026-11-07", [away("cook", "2026-11-07", "2026-11-07", true)])).toBe(false);
  });

  // SPEC §12 case 12
  it("partial-day leave → the day is worked (paid in full)", () => {
    expect(cookWorkedOn(cook, "2026-11-07", [away("cook", "2026-11-07", "2026-11-07", false)])).toBe(true);
  });

  it("is not worked outside her employment dates", () => {
    expect(cookWorkedOn({ ...cook, left_on: "2026-11-01" }, "2026-11-07", [])).toBe(false);
  });
});

describe("headcount (SPEC §5.2)", () => {
  const members: PresenceMember[] = [
    flatmate("a"),
    flatmate("b"),
    flatmate("c"),
    flatmate("d"),
    flatmate("e"),
    flatmate("f6"),
    { id: "cook", role: "cook", joined_on: "2026-01-01", left_on: null },
    { id: "maid", role: "maid", joined_on: "2026-01-01", left_on: null },
  ];

  it("counts only present flatmates, never cook or maid", () => {
    expect(headcount(members, "2026-11-01", [])).toBe(6);
  });

  it("drops by one for each away flatmate", () => {
    const periods = [away("f6", "2026-11-05", "2027-02-05"), away("a", "2026-11-14", "2026-11-15")];
    expect(headcount(members, "2026-11-10", periods)).toBe(5);
    expect(headcount(members, "2026-11-14", periods)).toBe(4);
  });

  it("is unaffected by cook leave", () => {
    expect(headcount(members, "2026-11-07", [away("cook", "2026-11-07", "2026-11-07")])).toBe(6);
  });
});

describe("awayOn", () => {
  it("lists the periods covering a date", () => {
    const periods = [away("a", "2026-11-14", "2026-11-15"), away("b", "2026-11-16", "2026-11-16")];
    expect(awayOn("2026-11-15", periods).map((p) => p.member_id)).toEqual(["a"]);
    expect(awayOn("2026-11-17", periods)).toEqual([]);
  });
});

describe("returnDate and isLongAway", () => {
  it("returns the day after the away period ends", () => {
    expect(returnDate(away("a", "2026-11-14", "2026-11-15"))).toBe("2026-11-16");
    expect(returnDate(away("a", "2026-11-05", "2027-02-05"))).toBe("2027-02-06");
  });

  it("flags absences of 30 days or more as long away", () => {
    expect(isLongAway(away("a", "2026-11-05", "2027-02-05"))).toBe(true);
    expect(isLongAway(away("a", "2026-11-01", "2026-11-30"))).toBe(true);
    expect(isLongAway(away("a", "2026-11-01", "2026-11-29"))).toBe(false);
    expect(isLongAway(away("a", "2026-11-14", "2026-11-15"))).toBe(false);
  });
});

describe("isPresentFor and per-meal headcount (part-day slots)", () => {
  const night = [away("a", "2026-11-14", "2026-11-14", false, ["night"])];

  it("out at night: misses dinner only", () => {
    const m = flatmate("a");
    expect(isPresentFor(m, "2026-11-14", night, "breakfast")).toBe(true);
    expect(isPresentFor(m, "2026-11-14", night, "lunch")).toBe(true);
    expect(isPresentFor(m, "2026-11-14", night, "dinner")).toBe(false);
    expect(isPresentFor(m, "2026-11-15", night, "dinner")).toBe(true);
  });

  it("morning is breakfast, afternoon is lunch", () => {
    const p = [away("a", "2026-11-14", "2026-11-14", false, ["morning", "afternoon"])];
    expect(isPresentFor(flatmate("a"), "2026-11-14", p, "breakfast")).toBe(false);
    expect(isPresentFor(flatmate("a"), "2026-11-14", p, "lunch")).toBe(false);
    expect(isPresentFor(flatmate("a"), "2026-11-14", p, "dinner")).toBe(true);
  });

  it("a full-day absence misses every meal", () => {
    const p = [away("a", "2026-11-14", "2026-11-14")];
    expect(isPresentFor(flatmate("a"), "2026-11-14", p, "breakfast")).toBe(false);
    expect(isPresentFor(flatmate("a"), "2026-11-14", p, "dinner")).toBe(false);
  });

  it("a part-day period without slots (older data) misses every meal but stays present", () => {
    const p = [away("a", "2026-11-14", "2026-11-14", false)];
    expect(isPresent(flatmate("a"), "2026-11-14", p)).toBe(true);
    expect(isPresentFor(flatmate("a"), "2026-11-14", p, "lunch")).toBe(false);
  });

  it("headcount per meal drops only for that meal", () => {
    const members = [flatmate("a"), flatmate("b"), flatmate("c")];
    expect(headcount(members, "2026-11-14", night)).toBe(3);
    expect(headcount(members, "2026-11-14", night, "lunch")).toBe(3);
    expect(headcount(members, "2026-11-14", night, "dinner")).toBe(2);
  });

  it("writes slots as a phrase", () => {
    expect(slotsPhrase(["night"])).toBe("at night");
    expect(slotsPhrase(["night", "morning"])).toBe("in the morning and at night");
    expect(slotsPhrase(["morning", "afternoon", "night"])).toBe("in the morning, in the afternoon and at night");
  });
});
