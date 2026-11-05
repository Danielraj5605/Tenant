import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_FILES, toDeno } from "../../scripts/sync-engine.mjs";

const lf = (s: string) => s.replace(/\r\n/g, "\n");

describe("Edge Function engine copy", () => {
  it.each(ENGINE_FILES as string[])("%s matches lib/engine (run npm run engine:sync)", (file) => {
    const src = fs.readFileSync(path.join(__dirname, file), "utf8");
    const copy = fs.readFileSync(path.join(__dirname, "../../supabase/functions/_shared/engine", file), "utf8");
    expect(lf(copy)).toBe(lf(toDeno(src)));
  });
});
