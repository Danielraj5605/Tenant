import { describe, expect, it } from "vitest";
import { isDue, isoWeekday, nextAssignee, planToday, projectAssignments, scheduleLabel, type Chore } from "./rotation";
import type { AwayPeriod, PresenceMember } from "./presence";

const m = (id: string): PresenceMember => ({ id, role: "flatmate", joined_on: "2026-01-01", left_on: null });
const members = [m("a"), m("b"), m("c"), m("d")];
const away = (member_id: string, start_date: string, end_date: string): AwayPeriod => ({
  member_id,
  start_date,
  end_date,
  full_day: true,
});

const daily: Chore = { id: "garbage", frequency: "daily", days_of_week: [] };
const rotation = ["a", "b", "c", "d"];

describe("isDue and schedule", () => {
  it("uses ISO weekdays (Mon = 1, Sun = 7)", () => {
    expect(isoWeekday("2026-11-02")).toBe(1); // Monday
    expect(isoWeekday("2026-11-08")).toBe(7); // Sunday
  });

  it("daily chores are always due; weekly and custom follow days_of_week", () => {
    expect(isDue(daily, "2026-11-08")).toBe(true);
    const weekly: Chore = { id: "w", frequency: "weekly", days_of_week: [6] };
    expect(isDue(weekly, "2026-11-07")).toBe(true); // Saturday
    expect(isDue(weekly, "2026-11-06")).toBe(false);
  });

  it("labels the schedule", () => {
    expect(scheduleLabel(daily)).toBe("Every day");
    expect(scheduleLabel({ id: "w", frequency: "weekly", days_of_week: [6] })).toBe("Every Sat");
    expect(scheduleLabel({ id: "c", frequency: "custom", days_of_week: [4, 1] })).toBe("Mon, Thu");
  });
});

describe("nextAssignee (SPEC §5.3)", () => {
  it("starts after the last assignee in rotation order", () => {
    expect(nextAssignee(rotation, "a", "2026-11-10", members, [])).toBe("b");
  });

  it("wraps around to the start", () => {
    expect(nextAssignee(rotation, "d", "2026-11-10", members, [])).toBe("a");
  });

  it("starts at the first member when nobody has done it yet", () => {
    expect(nextAssignee(rotation, null, "2026-11-10", members, [])).toBe("a");
  });

  // SPEC §12 case 8
  it("skips an away member to the following present member", () => {
    expect(nextAssignee(rotation, "a", "2026-11-14", members, [away("b", "2026-11-14", "2026-11-15")])).toBe("c");
  });

  // SPEC §12 case 9
  it("returns null (skipped) when everyone in the rotation is away", () => {
    const periods = rotation.map((id) => away(id, "2026-11-14", "2026-11-14"));
    expect(nextAssignee(rotation, "a", "2026-11-14", members, periods)).toBeNull();
  });

  it("treats a last assignee who left the rotation as no history", () => {
    expect(nextAssignee(rotation, "zz", "2026-11-10", members, [])).toBe("a");
  });

  it("returns null for an empty rotation", () => {
    expect(nextAssignee([], null, "2026-11-10", members, [])).toBeNull();
  });
});

describe("projectAssignments", () => {
  it("chains owners across due days and records skipped days", () => {
    const weekly: Chore = { id: "cans", frequency: "custom", days_of_week: [1, 3, 5] };
    const periods = [away("b", "2026-11-04", "2026-11-04"), ...rotation.map((id) => away(id, "2026-11-06", "2026-11-06"))];
    const plan = projectAssignments(weekly, rotation, "a", "2026-11-02", 7, members, periods);
    expect(plan).toEqual([
      { date: "2026-11-02", memberId: "b" },
      { date: "2026-11-04", memberId: "c" }, // b away, skips to c
      { date: "2026-11-06", memberId: null }, // everyone away
    ]);
  });

  it("a skipped day does not advance the rotation", () => {
    const periods = rotation.map((id) => away(id, "2026-11-10", "2026-11-10"));
    const plan = projectAssignments(daily, rotation, "a", "2026-11-09", 3, members, periods);
    expect(plan.map((p) => p.memberId)).toEqual(["b", null, "c"]);
  });
});

describe("planToday", () => {
  it("creates rows only for due chores without an assignment", () => {
    const weekly: Chore = { id: "w", frequency: "weekly", days_of_week: [2] };
    const rows = planToday({
      date: "2026-11-10", // Tuesday
      chores: [daily, weekly, { id: "done-already", frequency: "daily", days_of_week: [] }],
      rotations: { garbage: rotation, w: ["c", "d"], "done-already": rotation },
      lastAssignees: { garbage: "b", w: null },
      existing: new Set(["done-already"]),
      members,
      periods: [away("c", "2026-11-10", "2026-11-10")],
    });
    expect(rows).toEqual([
      { choreId: "garbage", date: "2026-11-10", memberId: "d", status: "pending" },
      { choreId: "w", date: "2026-11-10", memberId: "d", status: "pending" },
    ]);
  });

  it("marks the day skipped when nobody is present", () => {
    const rows = planToday({
      date: "2026-11-10",
      chores: [daily],
      rotations: { garbage: ["a"] },
      lastAssignees: {},
      existing: new Set(),
      members,
      periods: [away("a", "2026-11-01", "2026-11-30")],
    });
    expect(rows).toEqual([{ choreId: "garbage", date: "2026-11-10", memberId: null, status: "skipped" }]);
  });
});
