import { describe, expect, it } from "vitest";
import { ProviderError, runChain, runWithFallback, type Provider } from "./fallback";

const ok = (name: string, value: string): Provider<string> => ({ name, run: async () => value });
const fail = (name: string, status: number | null): Provider<string> => ({
  name,
  run: async () => {
    throw new ProviderError("boom", status);
  },
});
const hang = (name: string): Provider<string> => ({
  name,
  run: (signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))),
});

describe("runWithFallback (SPEC §10.3)", () => {
  it("uses the primary when it works", async () => {
    expect(await runWithFallback(ok("gemini", "a"), ok("groq", "b"))).toEqual({ result: "a", provider: "gemini" });
  });

  it.each([422, 429, 500, 503])("falls back once on HTTP %i (422: reply wasn't the expected JSON)", async (status) => {
    expect(await runWithFallback(fail("gemini", status), ok("groq", "b"))).toEqual({ result: "b", provider: "groq" });
  });

  it("falls back on a timeout", async () => {
    expect(await runWithFallback(hang("gemini"), ok("groq", "b"), 20)).toEqual({ result: "b", provider: "groq" });
  });

  it("does not fall back on other errors (e.g. 400)", async () => {
    await expect(runWithFallback(fail("gemini", 400), ok("groq", "b"))).rejects.toThrow("boom");
  });

  it("retries only once: a failing fallback surfaces its error", async () => {
    await expect(runWithFallback(fail("gemini", 429), fail("groq", 503))).rejects.toMatchObject({ status: 503 });
  });

  it("works without a fallback configured", async () => {
    await expect(runWithFallback(fail("gemini", 429), null)).rejects.toMatchObject({ status: 429 });
  });
});

describe("runChain (PDFs: several Gemini models)", () => {
  it("moves down the chain past busy and hung models", async () => {
    expect(await runChain([fail("flash", 503), hang("flash-3"), ok("lite", "c")], 20)).toEqual({ result: "c", provider: "lite" });
  });

  it("stops at an error that isn't worth retrying", async () => {
    await expect(runChain([fail("flash", 429), fail("lite", 400), ok("flash-3", "c")])).rejects.toMatchObject({ status: 400 });
  });

  it("surfaces the last error when every model fails", async () => {
    await expect(runChain([fail("flash", 429), fail("lite", 503)])).rejects.toMatchObject({ status: 503 });
  });
});
