import { describe, expect, it } from "vitest";
import {
  CreateFlatInput,
  Password,
  Username,
  JoinRequestInput,
  defaultMemberName,
  formatFlatCode,
  normalizeFlatCode,
  safeNextPath,
} from "./onboarding";

describe("defaultMemberName", () => {
  it("prefers the Google full name, first word only", () => {
    expect(defaultMemberName({ full_name: "Daniel Raj" }, "d@example.com")).toBe("Daniel");
  });

  it("falls back to `name`, then the email local part", () => {
    expect(defaultMemberName({ name: "Priya S" }, "p@example.com")).toBe("Priya");
    expect(defaultMemberName({}, "arun.k@example.com")).toBe("arun.k");
    expect(defaultMemberName(undefined, undefined)).toBe("");
  });

  it("caps the length at 40 characters", () => {
    expect(defaultMemberName({ full_name: "x".repeat(60) }, null)).toHaveLength(40);
  });
});

describe("flat codes", () => {
  it("accepts any case, spaces and dashes", () => {
    expect(normalizeFlatCode("K7M4QX")).toBe("K7M4QX");
    expect(normalizeFlatCode(" k7m-4qx ")).toBe("K7M4QX");
    expect(normalizeFlatCode("k7m 4qx")).toBe("K7M4QX");
  });

  it("rejects look-alike characters and wrong lengths", () => {
    expect(normalizeFlatCode("K7M4Q0")).toBeNull(); // zero
    expect(normalizeFlatCode("K7M4QI")).toBeNull(); // I
    expect(normalizeFlatCode("K7M4Q")).toBeNull();
    expect(normalizeFlatCode("K7M4QXX")).toBeNull();
    expect(normalizeFlatCode("")).toBeNull();
  });

  it("shows codes as three and three", () => {
    expect(formatFlatCode("K7M4QX")).toBe("K7M-4QX");
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/join/abc")).toBe("/join/abc");
    expect(safeNextPath("/today")).toBe("/today");
  });

  it("blocks open redirects", () => {
    expect(safeNextPath("https://evil.com")).toBe("/today");
    expect(safeNextPath("//evil.com")).toBe("/today");
    expect(safeNextPath("/\\evil.com")).toBe("/today");
    expect(safeNextPath(null)).toBe("/today");
  });
});

describe("form schemas", () => {
  it("trims and requires a flat name and your name", () => {
    expect(CreateFlatInput.parse({ flatName: "  Flat 4B ", memberName: " Daniel " })).toEqual({
      flatName: "Flat 4B",
      memberName: "Daniel",
    });
    expect(CreateFlatInput.safeParse({ flatName: "  ", memberName: "Daniel" }).success).toBe(false);
    expect(CreateFlatInput.safeParse({ flatName: "Flat", memberName: "" }).success).toBe(false);
  });

  it("limits name lengths to match the database checks", () => {
    expect(CreateFlatInput.safeParse({ flatName: "x".repeat(61), memberName: "D" }).success).toBe(false);
    expect(JoinRequestInput.safeParse({ code: "K7M4QX", memberName: "x".repeat(41) }).success).toBe(false);
  });

  it("normalises the flat code in a join request", () => {
    expect(JoinRequestInput.safeParse({ code: "bad code", memberName: "Priya" }).success).toBe(false);
    expect(JoinRequestInput.parse({ code: "k7m-4qx", memberName: " Priya " })).toEqual({ code: "K7M4QX", memberName: "Priya" });
  });
});

describe("usernames", () => {
  it("normalises and validates usernames", () => {
    expect(Username.parse("  Daniel.R ")).toBe("daniel.r");
    expect(Username.safeParse("ab").success).toBe(false);
    expect(Username.safeParse("has space").success).toBe(false);
    expect(Username.safeParse("x".repeat(21)).success).toBe(false);
    expect(Username.safeParse("priya_99").success).toBe(true);
  });

  it("requires passwords of at least 8 characters", () => {
    expect(Password.safeParse("short").success).toBe(false);
    expect(Password.safeParse("long enough").success).toBe(true);
  });
});
