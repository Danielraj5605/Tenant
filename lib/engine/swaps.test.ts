import { describe, expect, it } from "vitest";
import { openTurns, swapExpired, swapProblem } from "./swaps";
import { projectAssignments } from "./rotation";

const turns = [
  { date: "2026-11-12", memberId: "rishab" },
  { date: "2026-11-13", memberId: "karthik" },
  { date: "2026-11-14", memberId: "madan" },
];
const home = () => true;
const base = { turns, fromMember: "madan", fromDate: "2026-11-14", toMember: "rishab", toDate: "2026-11-12", today: "2026-11-11", isHome: home };

describe("swapProblem", () => {
  it("allows swapping my day for someone else's", () => {
    expect(swapProblem(base)).toBeNull();
  });

  it("refuses same person, same day, past days and changed turns", () => {
    expect(swapProblem({ ...base, toMember: "madan" })).toMatch(/someone else/);
    expect(swapProblem({ ...base, toDate: "2026-11-14" })).toMatch(/two different days/);
    expect(swapProblem({ ...base, today: "2026-11-13" })).toMatch(/passed/);
    expect(swapProblem({ ...base, fromDate: "2026-11-13" })).toMatch(/isn't your turn/);
    expect(swapProblem({ ...base, toMember: "karthik" })).toMatch(/isn't their turn/);
  });

  it("refuses when either person is away on the new day", () => {
    expect(swapProblem({ ...base, isHome: (m, d) => !(m === "rishab" && d === "2026-11-14") })).toMatch(/They're away/);
    expect(swapProblem({ ...base, isHome: (m, d) => !(m === "madan" && d === "2026-11-12") })).toMatch(/You're away/);
  });
});

describe("openTurns", () => {
  it("includes today only while it's still to do", () => {
    const up = [{ date: "2026-11-12", memberId: "a" }, { date: "2026-11-13", memberId: null }];
    expect(openTurns("2026-11-11", { member_id: "b", status: "pending" }, up)).toEqual([
      { date: "2026-11-11", memberId: "b" },
      { date: "2026-11-12", memberId: "a" },
    ]);
    expect(openTurns("2026-11-11", { member_id: "b", status: "done" }, up)).toEqual([{ date: "2026-11-12", memberId: "a" }]);
  });
});

describe("swapExpired", () => {
  it("expires once either day has passed", () => {
    expect(swapExpired({ from_date: "2026-11-12", to_date: "2026-11-14" }, "2026-11-12")).toBe(false);
    expect(swapExpired({ from_date: "2026-11-12", to_date: "2026-11-14" }, "2026-11-13")).toBe(true);
  });
});

describe("a swap doesn't shift the rest of the rotation", () => {
  it("chaining from the rotation's own turn keeps later days the same", () => {
    const chore = { id: "c", frequency: "daily" as const, days_of_week: [] };
    const people = ["a", "b", "c"].map((id) => ({ id, role: "flatmate" as const, joined_on: "2026-01-01", left_on: null }));
    // Without a swap: a, b, c, a, b ...
    const plain = projectAssignments(chore, ["a", "b", "c"], "c", "2026-11-12", 5, people, []);
    expect(plain.map((d) => d.memberId)).toEqual(["a", "b", "c", "a", "b"]);
    // a and c swap 12 and 14 Nov. The loader chains from the rotation's pick (a on 12 Nov),
    // so 13 Nov is still b and 15 Nov still a.
    const fromRotation = projectAssignments(chore, ["a", "b", "c"], "a", "2026-11-13", 4, people, []);
    expect(fromRotation.map((d) => d.memberId)).toEqual(["b", "c", "a", "b"]);
    // Chaining from who actually did it (c) would shift everyone: the bug this avoids.
    const shifted = projectAssignments(chore, ["a", "b", "c"], "c", "2026-11-13", 4, people, []);
    expect(shifted.map((d) => d.memberId)).not.toEqual(["b", "c", "a", "b"]);
  });
});
