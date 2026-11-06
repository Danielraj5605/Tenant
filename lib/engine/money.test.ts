import { describe, expect, it } from "vitest";
import {
  computeShares,
  cookPay,
  staffPay,
  daysPresentInMonth,
  defaultParticipants,
  formatINR,
  parseRupees,
  ruleNote,
  shareReasons,
  splitEqual,
  splitTotal,
  splitWeighted,
  statusText,
  type ExpenseItem,
} from "./money";
import type { AwayPeriod, PresenceMember } from "./presence";

const fm = (id: string): PresenceMember => ({ id, role: "flatmate", joined_on: "2026-01-01", left_on: null });
const five = ["m1", "m2", "m3", "m4", "m5"];
const people = (ids: string[], locks: Record<string, number> = {}) =>
  ids.map((id) => ({ id, included: true, locked: locks[id] ?? null }));

describe("formatINR and parseRupees", () => {
  it("formats paise as rupees, dropping .00", () => {
    expect(formatINR(50000)).toBe("₹500");
    expect(formatINR(3334)).toBe("₹33.34");
    expect(formatINR(4320)).toBe("₹43.20");
    expect(formatINR(10000000)).toBe("₹1,00,000");
    expect(formatINR(-4000)).toBe("−₹40");
  });

  it("parses typed rupee amounts into integer paise without floats", () => {
    expect(parseRupees("500")).toBe(50000);
    expect(parseRupees("33.34")).toBe(3334);
    expect(parseRupees("43.2")).toBe(4320);
    expect(parseRupees("0.29")).toBe(29);
    expect(parseRupees("1,00,000")).toBe(10000000);
    expect(parseRupees(" ₹64 ")).toBe(6400);
  });

  it("rejects anything that isn't a rupee amount", () => {
    for (const bad of ["", "abc", "1.234", "-5", "1.2.3", "."]) expect(parseRupees(bad)).toBeNull();
  });
});

describe("splitEqual (SPEC §5.5 rounding)", () => {
  // SPEC §12 case 1
  it("₹500 among 5 → ₹100 each", () => {
    expect(splitEqual(50000, five)).toEqual({ m1: 10000, m2: 10000, m3: 10000, m4: 10000, m5: 10000 });
  });

  // SPEC §12 case 3
  it("₹100 among 3 → ₹33.34, ₹33.33, ₹33.33 (leftover to the first in member id order)", () => {
    expect(splitEqual(10000, ["c", "a", "b"])).toEqual({ a: 3334, b: 3333, c: 3333 });
  });

  it("always sums exactly", () => {
    const s = splitEqual(79900, ["a", "b", "c", "d", "e", "f"]);
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBe(79900);
  });
});

describe("computeShares (lock and redistribute)", () => {
  // SPEC §12 case 2
  it("₹200 among 5 with You locked at ₹64 → others ₹34 each; sum ₹200", () => {
    const r = computeShares(20000, people(five, { m1: 6400 }));
    expect(r.shares).toEqual({ m1: 6400, m2: 3400, m3: 3400, m4: 3400, m5: 3400 });
    expect(r.status).toEqual({ kind: "ok", total: 20000 });
    expect(statusText(r.status)).toBe("✓ Shares add up to ₹200");
  });

  // SPEC §12 case 5
  it("locked shares above the total → status shows the amount over (Save disabled)", () => {
    const r = computeShares(20000, people(five, { m1: 15000, m2: 9000 }));
    expect(r.status).toEqual({ kind: "over", amount: 4000 });
    expect(statusText(r.status)).toBe("Shares are ₹40 over the total");
    expect(r.canSave).toBe(false);
  });

  it("everyone locked below the total → amount still to assign", () => {
    const r = computeShares(20000, people(["a", "b"], { a: 5000, b: 5000 }));
    expect(r.status).toEqual({ kind: "remaining", amount: 10000 });
    expect(statusText(r.status)).toBe("₹100 still to assign");
    expect(r.canSave).toBe(false);
  });

  it("unchecking a person removes them and ignores their lock", () => {
    const list = [...people(["a", "b", "c"]), { id: "d", included: false, locked: 9900 }];
    const r = computeShares(30000, list);
    expect(r.shares).toEqual({ a: 10000, b: 10000, c: 10000 });
  });

  it("nobody picked → 'Pick at least one person'", () => {
    const r = computeShares(30000, [{ id: "a", included: false, locked: null }]);
    expect(statusText(r.status)).toBe("Pick at least one person");
    expect(r.canSave).toBe(false);
  });

  it("adds personal items on top of the equal part (₹34 shared + ₹30 curd)", () => {
    // ₹200 total, ₹30 curd is m1's alone, ₹170 shared by 5.
    const list = five.map((id) => ({ id, included: true, locked: null, personal: id === "m1" ? 3000 : 0 }));
    const r = computeShares(20000, list);
    expect(r.shares.m1).toBe(3400 + 3000);
    expect(r.shares.m2).toBe(3400);
    expect(r.canSave).toBe(true);
  });

  it("supports weights for prorated monthly splits", () => {
    const list = [
      { id: "a", included: true, locked: null, weight: 30 },
      { id: "b", included: true, locked: null, weight: 10 },
    ];
    expect(computeShares(40000, list).shares).toEqual({ a: 30000, b: 10000 });
  });
});

describe("splitWeighted", () => {
  it("prorates by weight, gives leftover paise in member id order, and sums exactly", () => {
    const s = splitWeighted(10000, { b: 1, a: 1, c: 1 });
    expect(s).toEqual({ a: 3334, b: 3333, c: 3333 });
    const p = splitWeighted(1500000, { x: 30, y: 10, z: 0 });
    expect(p).toEqual({ x: 1125000, y: 375000 });
  });
});

describe("splitTotal (SPEC §9 split total)", () => {
  // SPEC §12 case 6
  it("Zepto ₹256 with a ₹40 chocolate bar unticked → ₹216 split at ₹43.20 each for 5", () => {
    const items: ExpenseItem[] = [
      { name: "Milk", amountPaise: 6000, kind: "item", included: true, personalMemberId: null },
      { name: "Bread", amountPaise: 5000, kind: "item", included: true, personalMemberId: null },
      { name: "Atta", amountPaise: 10000, kind: "item", included: true, personalMemberId: null },
      { name: "Chocolate bar", amountPaise: 4000, kind: "item", included: false, personalMemberId: null },
      { name: "Delivery charge", amountPaise: 500, kind: "fee", included: true, personalMemberId: null },
      { name: "Discount", amountPaise: 0, kind: "discount", included: true, personalMemberId: null },
      { name: "Handling fee", amountPaise: 100, kind: "fee", included: true, personalMemberId: null },
    ];
    expect(splitTotal(items, 25600)).toEqual({ split: 21600, notSplit: 4000 });
    const r = computeShares(21600, people(five));
    expect(Object.values(r.shares)).toEqual([4320, 4320, 4320, 4320, 4320]);
  });

  it("subtracts discounts and falls back to the typed total without items", () => {
    const items: ExpenseItem[] = [
      { name: "Rice", amountPaise: 50000, kind: "item", included: true, personalMemberId: null },
      { name: "Coupon", amountPaise: 5000, kind: "discount", included: true, personalMemberId: null },
    ];
    expect(splitTotal(items, 45000)).toEqual({ split: 45000, notSplit: 0 });
    expect(splitTotal([], 79900)).toEqual({ split: 79900, notSplit: 0 });
  });
});

describe("defaultParticipants (SPEC §5.4)", () => {
  const members = [fm("a"), fm("b"), fm("c"), fm("d"), fm("e"), fm("f6"), { ...fm("cook"), role: "cook" as const }];
  const longAway: AwayPeriod[] = [{ member_id: "f6", start_date: "2026-11-05", end_date: "2027-02-05", full_day: true }];

  // SPEC §12 case 10
  it("long-away member is excluded from groceries and gas, included in rent and WiFi", () => {
    expect(defaultParticipants("present_only", members, "2026-11-20", longAway)).toEqual(["a", "b", "c", "d", "e"]);
    expect(defaultParticipants("all_members", members, "2026-11-20", longAway)).toEqual(["a", "b", "c", "d", "e", "f6"]);
  });

  it("a part-day absence keeps them in present-only splits", () => {
    const night: AwayPeriod[] = [{ member_id: "a", start_date: "2026-11-20", end_date: "2026-11-20", full_day: false, slots: ["night"] }];
    expect(defaultParticipants("present_only", members, "2026-11-20", night)).toContain("a");
  });

  // SPEC §12 case 4
  it("WiFi ₹799, all_members, 6 members with one away → ₹133.17 × 4 and ₹133.16 × 2", () => {
    const ids = defaultParticipants("all_members", members, "2026-11-20", longAway);
    const shares = Object.values(splitEqual(79900, ids)).sort((x, y) => y - x);
    expect(shares).toEqual([13317, 13317, 13317, 13317, 13316, 13316]);
  });

  it("never includes the cook or maid, or people who have left", () => {
    const left = [{ ...fm("z"), left_on: "2026-10-31" }];
    expect(defaultParticipants("all_members", [...members, ...left], "2026-11-20", [])).not.toContain("cook");
    expect(defaultParticipants("all_members", [...members, ...left], "2026-11-20", [])).not.toContain("z");
  });
});

describe("cook pay and prorating (SPEC §2, §5.6)", () => {
  const cook: PresenceMember = { id: "cook", role: "cook", joined_on: "2026-01-01", left_on: null };

  it("pays the daily rate for each worked day; full-day leave is unpaid, partial is paid", () => {
    const periods: AwayPeriod[] = [
      { member_id: "cook", start_date: "2026-11-07", end_date: "2026-11-07", full_day: true },
      { member_id: "cook", start_date: "2026-11-12", end_date: "2026-11-12", full_day: false },
    ];
    expect(cookPay(50000, cook, "2026-11", periods)).toEqual({ daysWorked: 29, days: 30, totalPaise: 1450000 });
  });

  it("counts days present in a month for prorating", () => {
    const periods: AwayPeriod[] = [{ member_id: "a", start_date: "2026-11-01", end_date: "2026-11-20", full_day: true }];
    expect(daysPresentInMonth(fm("a"), "2026-11", periods)).toBe(10);
    expect(daysPresentInMonth(fm("b"), "2026-11", periods)).toBe(30);
  });
});

describe("explanations", () => {
  it("writes the rule note", () => {
    expect(ruleNote({ rule: "present_only", awayNames: ["Flatmate 6"] })).toBe("Present-only rule: Flatmate 6 is away");
    expect(ruleNote({ rule: "present_only", awayNames: ["Arun", "Priya"] })).toBe("Present-only rule: Arun and Priya are away");
    expect(ruleNote({ rule: "present_only", awayNames: [] })).toBe("Present-only rule: everyone was home");
    expect(ruleNote({ rule: "all_members", awayNames: ["Arun"] })).toBe("All-members rule: everyone pays, including Arun (away)");
    expect(ruleNote({ rule: "custom", awayNames: [], edited: true })).toBe("Custom amounts");
    expect(ruleNote({ rule: "present_only", awayNames: [], edited: true })).toBe(
      "Present-only rule: everyone was home. Some amounts were set by hand",
    );
    expect(
      ruleNote({ rule: "per_day_worked", awayNames: [], pay: { daysWorked: 29, days: 30, ratePaise: 50000 }, prorated: true }),
    ).toBe("Cook's pay: 29 of 30 days worked at ₹500/day, split by days each person was home");
  });

  it("explains each share", () => {
    const items: ExpenseItem[] = [
      { name: "Wheat flour 500 g", amountPaise: 29800, kind: "item", included: true, personalMemberId: null },
      { name: "Harpic", amountPaise: 19500, kind: "item", included: true, personalMemberId: null },
      { name: "Curd", amountPaise: 3000, kind: "item", included: true, personalMemberId: "m1" },
      { name: "Delivery charge", amountPaise: 500, kind: "fee", included: true, personalMemberId: null },
      { name: "Handling fee", amountPaise: 200, kind: "fee", included: true, personalMemberId: null },
    ];
    const reasons = shareReasons({ items, shares: { m1: 13000, m2: 10000 }, locked: new Set(), personalTotals: { m1: 3000 } });
    expect(reasons.m2).toBe("Wheat flour 500 g, Harpic, fees");
    expect(reasons.m1).toBe("₹100 shared + ₹30 Curd");
    expect(shareReasons({ items: [], shares: { a: 100 }, locked: new Set(["a"]), personalTotals: {} }).a).toBe(
      "Set by hand",
    );
    expect(shareReasons({ items: [], shares: { a: 100 }, locked: new Set(), personalTotals: {} }).a).toBe("Equal share");
  });
});

describe("split snapshot (SPEC §5.5)", () => {
  // SPEC §12 case 13. The database stores the shares as plain rows and nothing
  // recomputes them; this checks the engine never reads saved shares back
  // through presence.
  it("editing an away period after saving does not change the saved shares", () => {
    const members = ["a", "b", "c"].map(fm);
    const before: AwayPeriod[] = [{ member_id: "c", start_date: "2026-11-10", end_date: "2026-11-12", full_day: true }];
    const ids = defaultParticipants("present_only", members, "2026-11-11", before);
    const saved = structuredClone(computeShares(30000, people(ids)).shares);

    const after: AwayPeriod[] = []; // the away period is deleted later
    expect(defaultParticipants("present_only", members, "2026-11-11", after)).toEqual(["a", "b", "c"]);
    expect(saved).toEqual({ a: 15000, b: 15000 });
  });
});

describe("staffPay", () => {
  const lakshmi: PresenceMember = { id: "l", role: "cook", joined_on: "2026-08-01", left_on: "2026-11-05" };
  const mary: PresenceMember = { id: "y", role: "cook", joined_on: "2026-11-06", left_on: null };
  const flatmate: PresenceMember = { id: "f", role: "flatmate", joined_on: "2026-08-01", left_on: null };

  it("adds up the days of a cook who left and the one who replaced her", () => {
    // Lakshmi 1–5 Nov (5 days) + Mary 6–30 Nov (25 days), Mary off on 8 Nov.
    const periods: AwayPeriod[] = [{ member_id: "y", start_date: "2026-11-08", end_date: "2026-11-08", full_day: true }];
    expect(staffPay("cook", 30000, [lakshmi, mary, flatmate], "2026-11", periods)).toEqual({ daysWorked: 29, days: 30, totalPaise: 870000 });
  });

  it("ignores a cook who wasn't employed that month", () => {
    expect(staffPay("cook", 30000, [lakshmi, mary], "2026-10", [])).toEqual({ daysWorked: 31, days: 31, totalPaise: 930000 });
  });

  it("is null with no cook that month", () => {
    expect(staffPay("cook", 30000, [flatmate], "2026-11", [])).toBeNull();
  });
});

describe("maid's pay", () => {
  const selvi: PresenceMember = { id: "s", role: "maid", joined_on: "2026-08-01", left_on: null };
  const cook: PresenceMember = { id: "c", role: "cook", joined_on: "2026-08-01", left_on: null };

  it("counts the maid's days worked, not the cook's", () => {
    // Selvi off 20–21 Oct; the cook's leave doesn't matter here.
    const periods: AwayPeriod[] = [
      { member_id: "s", start_date: "2026-10-20", end_date: "2026-10-21", full_day: true },
      { member_id: "c", start_date: "2026-10-13", end_date: "2026-10-13", full_day: true },
    ];
    expect(staffPay("maid", 15000, [selvi, cook], "2026-10", periods)).toEqual({ daysWorked: 29, days: 31, totalPaise: 435000 });
  });

  it("explains it as the maid's pay", () => {
    expect(ruleNote({ rule: "per_day_worked", awayNames: [], pay: { daysWorked: 29, days: 31, ratePaise: 15000, role: "maid" } })).toBe(
      "Maid's pay: 29 of 31 days worked at ₹150/day, split among those at home",
    );
  });
});
