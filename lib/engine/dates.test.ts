import { describe, expect, it } from "vitest";
import { FLAT_TZ, greetingFor, hourIn, isIsoDate, todayIn } from "./dates";

describe("todayIn", () => {
  it("uses Asia/Kolkata by default", () => {
    expect(FLAT_TZ).toBe("Asia/Kolkata");
  });

  it("rolls over at midnight IST, not UTC", () => {
    // 18:29 UTC = 23:59 IST on 4 Nov
    expect(todayIn(FLAT_TZ, new Date("2026-11-04T18:29:00Z"))).toBe("2026-11-04");
    // 18:30 UTC = 00:00 IST on 5 Nov
    expect(todayIn(FLAT_TZ, new Date("2026-11-04T18:30:00Z"))).toBe("2026-11-05");
  });

  it("returns an ISO yyyy-mm-dd string", () => {
    expect(todayIn(FLAT_TZ, new Date("2027-02-05T06:00:00Z"))).toBe("2027-02-05");
  });
});

describe("hourIn and greetingFor", () => {
  it("reads the hour in flat time", () => {
    expect(hourIn(FLAT_TZ, new Date("2026-11-05T00:30:00Z"))).toBe(6);
  });

  it.each([
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [16, "Good afternoon"],
    [17, "Good evening"],
    [23, "Good evening"],
    [2, "Good evening"],
  ])("hour %i → %s", (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected);
  });
});

describe("isIsoDate", () => {
  it("accepts real calendar dates", () => {
    expect(isIsoDate("2026-11-05")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects malformed or impossible dates", () => {
    expect(isIsoDate("2026-11-5")).toBe(false);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});
