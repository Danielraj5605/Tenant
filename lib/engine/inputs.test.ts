import { describe, expect, it } from "vitest";
import { AwayPeriodInput, ChoreInput, ExpensePayload, MemberEditInput, ScheduleInput, StaffEditInput, StaffInput } from "./inputs";

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
      slots: null,
      reason: "Home for the weekend",
    });
  });

  it("treats a missing checkbox as a part day and an empty reason as none", () => {
    const parsed = AwayPeriodInput.parse({
      memberId: id,
      startDate: "2026-11-07",
      endDate: "2026-11-07",
      slots: ["night"],
      reason: "",
    });
    expect(parsed.fullDay).toBe(false);
    expect(parsed.slots).toEqual(["night"]);
    expect(parsed.reason).toBeNull();
  });

  it("orders slots, drops unknown ones and accepts a single value", () => {
    const base = { memberId: id, startDate: "2026-11-07", endDate: "2026-11-07" };
    expect(AwayPeriodInput.parse({ ...base, slots: ["night", "lunch", "morning", "night"] }).slots).toEqual(["morning", "night"]);
    expect(AwayPeriodInput.parse({ ...base, slots: "afternoon" }).slots).toEqual(["afternoon"]);
  });

  it("a part day needs at least one slot", () => {
    const r = AwayPeriodInput.safeParse({ memberId: id, startDate: "2026-11-07", endDate: "2026-11-07", slots: [] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["slots"]);
  });

  it("a part day must be a single day", () => {
    const r = AwayPeriodInput.safeParse({ memberId: id, startDate: "2026-11-07", endDate: "2026-11-08", slots: ["night"] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["endDate"]);
  });

  it("drops slots on a full day", () => {
    const parsed = AwayPeriodInput.parse({
      memberId: id,
      startDate: "2026-11-07",
      endDate: "2026-11-09",
      fullDay: "true",
      slots: ["night"],
    });
    expect(parsed.slots).toBeNull();
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
    expect(StaffInput.parse({ name: " Lakshmi ", role: "cook" })).toEqual({ name: "Lakshmi", role: "cook", phone: null });
    expect(StaffInput.safeParse({ name: "Meena", role: "maid" }).success).toBe(true);
  });

  it("refuses flatmates (they join by invite link)", () => {
    expect(StaffInput.safeParse({ name: "Arun", role: "flatmate" }).success).toBe(false);
  });
});

describe("StaffEditInput", () => {
  const base = { memberId: id, name: "Mary", role: "cook" };
  it("accepts an optional phone number and leaving date", () => {
    expect(StaffEditInput.parse({ ...base, phone: " +91 98765  43210 ", leftOn: "" })).toEqual({
      ...base,
      phone: "+91 98765 43210",
      leftOn: null,
    });
    expect(StaffEditInput.parse({ ...base, phone: "" }).phone).toBeNull();
  });

  it("refuses something that isn't a phone number", () => {
    expect(StaffEditInput.safeParse({ ...base, phone: "call me" }).success).toBe(false);
    expect(StaffEditInput.safeParse({ ...base, phone: "123" }).success).toBe(false);
  });

  it("only allows cook or maid", () => {
    expect(StaffEditInput.safeParse({ ...base, role: "flatmate" }).success).toBe(false);
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

  it("takes an optional cook/maid role and rejects anything else", () => {
    expect(MemberEditInput.parse({ memberId: id, name: "Selvi", leftOn: "", role: "cook" }).role).toBe("cook");
    expect(MemberEditInput.parse({ memberId: id, name: "Selvi", leftOn: "", role: "" }).role).toBeUndefined();
    expect(MemberEditInput.safeParse({ memberId: id, name: "Selvi", leftOn: "", role: "flatmate" }).success).toBe(false);
  });
});

describe("ChoreInput", () => {
  const a = "7d3c1a54-2f7e-4c11-9a0b-1f2e3d4c5b6a";
  const b = "8e4d2b65-3a8f-4d22-8b1c-2a3f4e5d6c7b";

  it("parses a daily chore with an ordered rotation", () => {
    expect(
      ChoreInput.parse({ name: " Garbage ", frequency: "daily", days: "", dueTime: "", rotation: JSON.stringify([b, a]) }),
    ).toEqual({
      name: "Garbage",
      frequency: "daily",
      days: [],
      dueTime: null,
      rotation: [b, a],
      everyMonths: null,
      dayOfMonth: null,
      startMonth: null,
    });
  });

  it("requires days for weekly and custom chores, and exactly one for weekly", () => {
    const base = { name: "Water cans", dueTime: "09:00", rotation: JSON.stringify([a]) };
    expect(ChoreInput.safeParse({ ...base, frequency: "custom", days: "" }).success).toBe(false);
    expect(ChoreInput.safeParse({ ...base, frequency: "weekly", days: "1,4" }).success).toBe(false);
    expect(ChoreInput.parse({ ...base, frequency: "custom", days: "4,1" }).days).toEqual([1, 4]);
  });

  it("needs at least one person in the rotation, without duplicates", () => {
    const base = { name: "Kitchen", frequency: "daily", days: "", dueTime: "" };
    expect(ChoreInput.safeParse({ ...base, rotation: "[]" }).success).toBe(false);
    expect(ChoreInput.safeParse({ ...base, rotation: JSON.stringify([a, a]) }).success).toBe(false);
  });
});

describe("ExpensePayload", () => {
  const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  const base = {
    id: null,
    title: "Zepto groceries",
    merchant: null,
    categoryId: ids[0],
    date: "2026-11-05",
    paidBy: ids[0],
    totalPaise: 50000,
    source: "manual" as const,
    billImagePath: null,
    items: [],
    dailyRatePaise: null,
  };

  it("accepts shares that sum exactly to the total", () => {
    const shares = [
      { memberId: ids[0], amountPaise: 25000, isCustom: false },
      { memberId: ids[1], amountPaise: 25000, isCustom: false },
    ];
    expect(ExpensePayload.safeParse({ ...base, shares }).success).toBe(true);
  });

  it("rejects shares a paisa off", () => {
    const shares = [
      { memberId: ids[0], amountPaise: 25000, isCustom: false },
      { memberId: ids[1], amountPaise: 24999, isCustom: false },
    ];
    expect(ExpensePayload.safeParse({ ...base, shares }).success).toBe(false);
  });

  it("checks shares against the ticked items when there are items", () => {
    const items = [
      { name: "Atta", quantity: null, amountPaise: 21600, kind: "item", included: true, personalMemberId: null },
      { name: "Chocolate", quantity: null, amountPaise: 4000, kind: "item", included: false, personalMemberId: null },
    ];
    const shares = [{ memberId: ids[0], amountPaise: 21600, isCustom: false }];
    expect(ExpensePayload.safeParse({ ...base, totalPaise: 25600, items, shares }).success).toBe(true);
    expect(
      ExpensePayload.safeParse({ ...base, totalPaise: 25600, items, shares: [{ ...shares[0], amountPaise: 25600 }] }).success,
    ).toBe(false);
  });
});

describe("ScheduleInput", () => {
  const day = (mode: string, meals = ["breakfast", "lunch", "dinner"], anchor: string | null = null) => ({ mode, meals, anchor });
  const parse = (role: string, days: unknown[]) => ScheduleInput.safeParse({ memberId: id, role, schedule: JSON.stringify(days) });

  it("stores a maid's Tue/Thu week, and an every-day week as null", () => {
    const week = [day("off"), day("every"), day("off"), day("every"), day("off"), day("off"), day("off")];
    const r = parse("maid", week);
    expect(r.success && r.data.schedule?.map((d) => d.mode)).toEqual(["off", "every", "off", "every", "off", "off", "off"]);
    const all = parse("cook", Array.from({ length: 7 }, () => day("every")));
    expect(all.success && all.data.schedule).toBeNull();
  });

  it("alternate weeks needs a date on that weekday", () => {
    const week = Array.from({ length: 7 }, () => day("every"));
    week[6] = day("alternate", ["breakfast", "lunch"], "2026-11-15"); // a Sunday
    expect(parse("cook", week).success).toBe(true);
    week[6] = day("alternate", ["breakfast"], "2026-11-16"); // a Monday
    expect(parse("cook", week).success).toBe(false);
    week[6] = day("alternate", ["breakfast"], null);
    expect(parse("cook", week).success).toBe(false);
  });

  it("a cook's working day needs a meal; anchors are dropped on other days", () => {
    const week = Array.from({ length: 7 }, () => day("every"));
    week[0] = day("every", []);
    expect(parse("cook", week).success).toBe(false);
    week[0] = day("off", [], "2026-11-09");
    const r = parse("cook", week);
    expect(r.success && r.data.schedule?.[0]).toEqual({ mode: "off", meals: [], anchor: null });
  });

  it("refuses the wrong number of days or bad JSON", () => {
    expect(parse("maid", [day("every")]).success).toBe(false);
    expect(ScheduleInput.safeParse({ memberId: id, role: "maid", schedule: "{" }).success).toBe(false);
  });
});

describe("ChoreInput, monthly", () => {
  const base = { name: "Rent", frequency: "monthly", days: "", dueTime: "", rotation: JSON.stringify([id]) };
  it("needs how often, a day, a first month and one person", () => {
    const ok = ChoreInput.parse({ ...base, everyMonths: "2", dayOfMonth: "10", startMonth: "2026-11" });
    expect(ok).toMatchObject({ frequency: "monthly", days: [], everyMonths: 2, dayOfMonth: 10, startMonth: "2026-11-01" });
    expect(ChoreInput.safeParse({ ...base, everyMonths: "1", startMonth: "2026-11" }).success).toBe(false);
    expect(ChoreInput.safeParse({ ...base, everyMonths: "1", dayOfMonth: "5" }).success).toBe(false);
    const two = JSON.stringify([id, "8d3c1a54-2f7e-4c11-9a0b-1f2e3d4c5b6a"]);
    expect(ChoreInput.safeParse({ ...base, rotation: two, everyMonths: "1", dayOfMonth: "5", startMonth: "2026-11" }).success).toBe(false);
  });

  it("weekly chores ignore the monthly fields", () => {
    const w = ChoreInput.parse({ ...base, frequency: "weekly", days: "3", everyMonths: "2", dayOfMonth: "5", startMonth: "2026-11" });
    expect(w).toMatchObject({ everyMonths: null, dayOfMonth: null, startMonth: null, days: [3] });
  });
});
