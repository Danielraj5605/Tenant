import { describe, expect, it } from "vitest";
import {
  defaultStartMonth,
  dueDateIn,
  monthlyLabel,
  monthlyStatus,
  occurrenceAfter,
  occurrenceOnOrBefore,
  occursIn,
  ordinal,
} from "./monthly";
import { isDue, planToday } from "./rotation";

const rent = { every_months: 1, day_of_month: 5, start_month: "2026-11-01" };
const eb = { every_months: 2, day_of_month: 10, start_month: "2026-11-01" };

describe("monthly occurrences", () => {
  it("rent is due every month from the first month", () => {
    expect(occursIn(rent, "2026-10")).toBe(false);
    expect(occursIn(rent, "2026-11")).toBe(true);
    expect(occursIn(rent, "2027-02")).toBe(true);
  });

  it("the EB bill is due every 2 months", () => {
    expect(["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"].map((m) => occursIn(eb, m))).toEqual([
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(occurrenceOnOrBefore(eb, "2026-12")).toBe("2026-11");
    expect(occurrenceOnOrBefore(eb, "2027-01")).toBe("2027-01");
    expect(occurrenceOnOrBefore(eb, "2026-10")).toBeNull();
    expect(occurrenceAfter(eb, "2026-11")).toBe("2027-01");
    expect(occurrenceAfter(eb, "2026-12")).toBe("2027-01");
    expect(occurrenceAfter(eb, "2026-09")).toBe("2026-11");
  });

  it("a day past the month's end falls on the last day", () => {
    const end = { ...rent, day_of_month: 31 };
    expect(dueDateIn(end, "2026-11")).toBe("2026-11-30");
    expect(dueDateIn(end, "2027-02")).toBe("2027-02-28");
    expect(dueDateIn(rent, "2026-12")).toBe("2026-12-05");
  });

  it("labels", () => {
    expect(monthlyLabel(rent)).toBe("Every month, by the 5th");
    expect(monthlyLabel(eb)).toBe("Every 2 months, by the 10th");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal).join(" ")).toBe("1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 31st");
  });

  it("starts next month when this month's due day has passed", () => {
    expect(defaultStartMonth(5, "2026-11-10")).toBe("2026-12");
    expect(defaultStartMonth(15, "2026-11-10")).toBe("2026-11");
    expect(defaultStartMonth(10, "2026-11-10")).toBe("2026-11");
  });

  it("status: due, overdue, done", () => {
    expect(monthlyStatus("2026-12-05", false, "2026-12-01")).toEqual({ kind: "due", dueDate: "2026-12-05", daysLeft: 4 });
    expect(monthlyStatus("2026-12-05", false, "2026-12-08")).toEqual({ kind: "overdue", dueDate: "2026-12-05", daysLate: 3 });
    expect(monthlyStatus("2026-12-05", true, "2026-12-08")).toEqual({ kind: "done", dueDate: "2026-12-05" });
  });
});

describe("the daily job never plans a monthly chore", () => {
  it("isDue is false and planToday skips it", () => {
    const chore = { id: "rent", frequency: "monthly" as const, days_of_week: [] };
    expect(isDue(chore, "2026-11-05")).toBe(false);
    expect(
      planToday({
        date: "2026-11-05",
        chores: [chore],
        rotations: { rent: ["madan"] },
        lastAssignees: {},
        existing: new Set(),
        members: [{ id: "madan", role: "flatmate", joined_on: "2026-01-01", left_on: null }],
        periods: [],
      }),
    ).toEqual([]);
  });
});
