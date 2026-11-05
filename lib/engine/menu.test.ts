import { describe, expect, it } from "vitest";
import { cookStatusOn, weekDates, weekStart } from "./menu";
import type { AwayPeriod, PresenceMember } from "./presence";

const cook: PresenceMember = { id: "cook", role: "cook", joined_on: "2026-01-01", left_on: null };
const leave = (full_day: boolean): AwayPeriod => ({ member_id: "cook", start_date: "2026-11-07", end_date: "2026-11-07", full_day });

describe("weekStart and weekDates", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-11-05")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekDates("2026-11-02")).toHaveLength(7);
    expect(weekDates("2026-11-02")[6]).toBe("2026-11-08");
  });
});

describe("cookStatusOn", () => {
  it("is 'cooking' on a normal day", () => {
    expect(cookStatusOn([cook], "2026-11-06", [leave(true)])).toEqual({ noCook: false, paid: true });
  });

  it("full-day leave: no cook for both meals, day unpaid (SPEC §12 case 11)", () => {
    expect(cookStatusOn([cook], "2026-11-07", [leave(true)])).toEqual({ noCook: true, paid: false });
  });

  it("partial leave: no cook for both meals, day still paid (SPEC §12 case 12)", () => {
    expect(cookStatusOn([cook], "2026-11-07", [leave(false)])).toEqual({ noCook: true, paid: true });
  });

  it("no cook in the flat means no 'No cook' prompts", () => {
    expect(cookStatusOn([], "2026-11-07", [])).toEqual({ noCook: false, paid: false });
  });
});
