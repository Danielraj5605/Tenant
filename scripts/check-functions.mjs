// Type-checks the Edge Functions with Deno, the way Supabase runs them: npm
// packages come from Deno's own cache, not this project's node_modules.
import { spawnSync } from "node:child_process";

const files = ["supabase/functions/notify/index.ts", "supabase/functions/daily/index.ts"];
const r = spawnSync("npx", ["-y", "deno@2.1.4", "check", ...files], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DENO_NO_PACKAGE_JSON: "1" },
});
process.exit(r.status ?? 1);
