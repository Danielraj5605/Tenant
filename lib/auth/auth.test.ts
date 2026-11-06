import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { newSessionPayload, shouldRenew, signSession, verifySession } from "./session";

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("Correct horse", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", "plain")).toBe(false);
  });
});

describe("sessions", () => {
  const secret = "test-secret-at-least-32-characters-long";
  const uid = "11111111-1111-4111-8111-111111111111";
  const exp = Math.floor(Date.now() / 1000) + 60;

  it("round-trips a valid token", async () => {
    const token = await signSession({ uid, exp }, secret);
    expect(await verifySession(token, secret)).toEqual({ uid, exp });
  });

  it("rejects tampered tokens, wrong secrets and expired tokens", async () => {
    const token = await signSession({ uid, exp }, secret);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "someone-else", exp })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`, secret)).toBeNull();
    expect(await verifySession(`${body}.${sig}x`, secret)).toBeNull();
    expect(await verifySession(token, "another-secret-of-sufficient-length!!")).toBeNull();
    expect(await verifySession(await signSession({ uid, exp: 1 }, secret), secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
    expect(await verifySession("garbage", secret)).toBeNull();
  });
});

describe("sliding sessions", () => {
  const t0 = Date.UTC(2026, 10, 6);
  const day = 24 * 60 * 60 * 1000;

  it("a fresh session lasts 180 days", () => {
    expect(newSessionPayload("u", t0).exp).toBe(t0 / 1000 + 180 * 24 * 60 * 60);
  });

  it("is not renewed on the same day", () => {
    expect(shouldRenew(newSessionPayload("u", t0), t0 + day - 1000)).toBe(false);
  });

  it("is renewed on a visit more than a day later", () => {
    expect(shouldRenew(newSessionPayload("u", t0), t0 + day + 1000)).toBe(true);
  });
});
