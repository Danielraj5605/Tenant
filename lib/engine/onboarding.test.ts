import { describe, expect, it } from "vitest";
import {
  CreateFlatInput,
  Password,
  USERNAME_DOMAIN,
  Username,
  loginEmail,
  JoinFlatInput,
  defaultMemberName,
  inviteCodeFrom,
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

describe("inviteCodeFrom", () => {
  it("accepts a bare code", () => {
    expect(inviteCodeFrom("Ab3_x-9QwErT")).toBe("Ab3_x-9QwErT");
  });

  it("extracts the code from a full invite link", () => {
    expect(inviteCodeFrom("https://tenant.app/join/Ab3_x-9QwErT")).toBe("Ab3_x-9QwErT");
    expect(inviteCodeFrom("  http://localhost:3000/join/Ab3_x-9QwErT?x=1 ")).toBe("Ab3_x-9QwErT");
  });

  it("rejects anything else", () => {
    expect(inviteCodeFrom("")).toBeNull();
    expect(inviteCodeFrom("not a code!")).toBeNull();
    expect(inviteCodeFrom("https://tenant.app/settings")).toBeNull();
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
    expect(JoinFlatInput.safeParse({ code: "Ab3_x-9QwErT", memberName: "x".repeat(41) }).success).toBe(false);
  });

  it("validates the invite code shape", () => {
    expect(JoinFlatInput.safeParse({ code: "bad code", memberName: "Priya" }).success).toBe(false);
    expect(JoinFlatInput.parse({ code: "Ab3_x-9QwErT", memberName: "Priya" }).code).toBe("Ab3_x-9QwErT");
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

  it("maps a username to its sign-in email, and passes real emails through", () => {
    expect(loginEmail("Daniel")).toBe(`daniel@${USERNAME_DOMAIN}`);
    expect(loginEmail(" me@example.com ")).toBe("me@example.com");
  });

  it("requires passwords of at least 8 characters", () => {
    expect(Password.safeParse("short").success).toBe(false);
    expect(Password.safeParse("long enough").success).toBe(true);
  });
});
