import { describe, expect, it } from "vitest";
import { everyDay, isEveryDay, nextOnWeekday, nextWorkingOn, scheduleNotes, scheduledOn, weekStrip, weekdayIndex, type WorkSchedule } from "./schedule";
import { cookStatusOn } from "./menu";
import { cookPay, staffPay } from "./money";
import { staffMonth, staffStatusOn } from "./staff";
import type { PresenceMember } from "./presence";

const all = ["breakfast", "lunch", "dinner"] as const;
const off = { mode: "off" as const, meals: [...all], anchor: null };
const every = { mode: "every" as const, meals: [...all], anchor: null };

// Maid: Tuesdays and Thursdays only.
const maidWeek: WorkSchedule = [off, every, off, every, off, off, off];
// Cook: every day, but Sundays on alternate weeks (working 15 Nov 2026) and no dinner then.
const cookWeek: WorkSchedule = [every, every, every, every, every, every, { mode: "alternate", meals: ["breakfast", "lunch"], anchor: "2026-11-15" }];

const base: PresenceMember = { id: "x", role: "cook", joined_on: "2026-10-01", left_on: null };
const selvi = { ...base, id: "selvi", role: "maid" as const, work_schedule: maidWeek };
const mary = { ...base, id: "mary", work_schedule: cookWeek };

describe("weekdayIndex", () => {
  it("is 0 for Monday and 6 for Sunday", () => {
    expect(weekdayIndex("2026-11-09")).toBe(0);
    expect(weekdayIndex("2026-11-15")).toBe(6);
  });
});

describe("scheduledOn", () => {
  it("no schedule means every day, every meal", () => {
    expect(scheduledOn(base, "2026-11-15")).toEqual({ works: true, meals: all });
    expect(scheduledOn({ ...base, work_schedule: everyDay() }, "2026-11-15")).toEqual({ works: true, meals: all });
  });

  it("maid works Tuesdays and Thursdays only", () => {
    expect(scheduledOn(selvi, "2026-11-10").works).toBe(true); // Tue
    expect(scheduledOn(selvi, "2026-11-12").works).toBe(true); // Thu
    expect(scheduledOn(selvi, "2026-11-11").works).toBe(false); // Wed
  });

  it("cook works alternate Sundays, without dinner, before and after the anchor", () => {
    expect(scheduledOn(mary, "2026-11-15")).toEqual({ works: true, meals: ["breakfast", "lunch"] });
    expect(scheduledOn(mary, "2026-11-22").works).toBe(false);
    expect(scheduledOn(mary, "2026-11-29").works).toBe(true);
    expect(scheduledOn(mary, "2026-11-08").works).toBe(false);
    expect(scheduledOn(mary, "2026-11-01").works).toBe(true);
    expect(scheduledOn(mary, "2026-11-14")).toEqual({ works: true, meals: all });
  });

  it("a cook day with no meals ticked is a day off", () => {
    const week = everyDay();
    week[0] = { mode: "every", meals: [], anchor: null };
    expect(scheduledOn({ ...base, work_schedule: week }, "2026-11-09").works).toBe(false);
  });
});

describe("cookStatusOn with a schedule", () => {
  it("no cook for dinner on a working Sunday, no cook at all on the other Sundays", () => {
    expect(cookStatusOn([mary], "2026-11-15", [])).toEqual({ noCook: true, noCookMeals: ["dinner"], paid: true });
    expect(cookStatusOn([mary], "2026-11-22", [])).toEqual({ noCook: true, noCookMeals: [...all], paid: false });
    expect(cookStatusOn([mary], "2026-11-16", [])).toEqual({ noCook: false, noCookMeals: [], paid: true });
  });
});

describe("pay by days worked with a schedule", () => {
  it("the maid is paid for her Tuesdays and Thursdays, minus leave", () => {
    // November 2026: Tuesdays 3, 10, 17, 24; Thursdays 5, 12, 19, 26 = 8 days.
    const leave = [{ member_id: "selvi", start_date: "2026-11-11", end_date: "2026-11-12", full_day: true }];
    expect(cookPay(20000, selvi, "2026-11", leave)).toEqual({ daysWorked: 7, days: 8, totalPaise: 140000 });
    expect(staffPay("maid", 20000, [selvi, mary], "2026-11", leave)).toEqual({ daysWorked: 7, days: 8, totalPaise: 140000 });
  });

  it("the cook isn't paid for her off Sundays", () => {
    // November 2026 has 5 Sundays (1, 8, 15, 22, 29); she works 1, 15 and 29.
    expect(cookPay(30000, mary, "2026-11", [])).toEqual({ daysWorked: 28, days: 28, totalPaise: 840000 });
  });
});

describe("staff page with a schedule", () => {
  it("days so far only count scheduled days", () => {
    expect(staffMonth(selvi, "2026-11", "2026-11-12", [])).toMatchObject({ daysSoFar: 4, workedSoFar: 4 });
  });

  it("a non-scheduled day is a day off, a short day lists the meals", () => {
    expect(staffStatusOn(selvi, "2026-11-11", [])).toEqual({ kind: "day_off" });
    expect(staffStatusOn(mary, "2026-11-15", [])).toEqual({ kind: "working", meals: ["breakfast", "lunch"] });
    expect(staffStatusOn(mary, "2026-11-16", [])).toEqual({ kind: "working" });
  });

  it("week strip and notes", () => {
    expect(weekStrip(selvi).map((c) => c.state)).toEqual(["off", "works", "off", "works", "off", "off", "off"]);
    expect(weekStrip(mary).at(-1)?.state).toBe("alternate");
    expect(scheduleNotes(mary, "2026-11-16")).toEqual(["Sun: alternate weeks (next 29 Nov), breakfast and lunch only"]);
    expect(scheduleNotes(selvi, "2026-11-16")).toEqual([]);
  });
});

describe("helpers", () => {
  it("nextOnWeekday and nextWorkingOn", () => {
    expect(nextOnWeekday(6, "2026-11-10")).toEqual(["2026-11-15", "2026-11-22"]);
    expect(nextOnWeekday(1, "2026-11-10")).toEqual(["2026-11-10", "2026-11-17"]);
    expect(nextWorkingOn("2026-11-15", "2026-11-16")).toBe("2026-11-29");
    expect(nextWorkingOn("2026-11-15", "2026-11-15")).toBe("2026-11-15");
  });

  it("isEveryDay", () => {
    expect(isEveryDay(null)).toBe(true);
    expect(isEveryDay(everyDay())).toBe(true);
    expect(isEveryDay(maidWeek)).toBe(false);
  });
});
