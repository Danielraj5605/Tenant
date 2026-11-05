import { describe, expect, it } from "vitest";
import {
  addDays,
  daysInclusive,
  formatRange,
  formatShortDate,
  monthGrid,
  monthOf,
  shiftMonth,
} from "./calendar";

describe("addDays and daysInclusive", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts both ends", () => {
    expect(daysInclusive("2026-11-14", "2026-11-15")).toBe(2);
    expect(daysInclusive("2026-11-05", "2027-02-05")).toBe(93);
  });
});

describe("months", () => {
  it("parses and shifts yyyy-mm", () => {
    expect(monthOf("2026-11-05")).toBe("2026-11");
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("builds a Monday-first grid of whole weeks", () => {
    const weeks = monthGrid("2026-11");
    // 1 Nov 2026 is a Sunday, so the first row starts Mon 26 Oct.
    expect(weeks[0][0]).toEqual({ date: "2026-10-26", inMonth: false });
    expect(weeks[0][6]).toEqual({ date: "2026-11-01", inMonth: true });
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const last = weeks[weeks.length - 1];
    expect(last[0].date).toBe("2026-11-30");
    expect(last[6]).toEqual({ date: "2026-12-06", inMonth: false });
  });
});

describe("formatting", () => {
  it("formats short dates the way the spec writes them", () => {
    expect(formatShortDate("2026-11-07")).toBe("Sat 7 Nov");
  });

  it("formats ranges compactly", () => {
    expect(formatRange("2026-11-14", "2026-11-14")).toBe("Sat 14 Nov");
    expect(formatRange("2026-11-14", "2026-11-15")).toBe("Sat 14 – Sun 15 Nov");
    expect(formatRange("2026-11-05", "2027-02-05")).toBe("5 Nov – 5 Feb");
  });
});
