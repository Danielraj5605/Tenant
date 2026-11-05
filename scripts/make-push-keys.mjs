// One-time setup for Web Push and the daily job. Writes secrets to files only
// (never prints them):
//   .env.local                 NEXT_PUBLIC_VAPID_PUBLIC_KEY (public, used by the browser)
//   supabase/.env.functions    VAPID keys + CRON_SECRET for Edge Functions
//   supabase/.vault-setup.sql  SQL to run once in the Supabase SQL Editor
// Re-running keeps existing keys unless --force is passed.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import webpush from "web-push";

const root = path.resolve(import.meta.dirname, "..");
const fnEnv = path.join(root, "supabase/.env.functions");
const localEnv = path.join(root, ".env.local");
const vaultSql = path.join(root, "supabase/.vault-setup.sql");
const force = process.argv.includes("--force");

const parse = (file) =>
  fs.existsSync(file)
    ? Object.fromEntries(
        fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
      )
    : {};

const existing = parse(fnEnv);
let keys = { publicKey: existing.VAPID_PUBLIC_KEY, privateKey: existing.VAPID_PRIVATE_KEY };
if (force || !keys.publicKey || !keys.privateKey) keys = webpush.generateVAPIDKeys();
const cronSecret = !force && existing.CRON_SECRET ? existing.CRON_SECRET : crypto.randomBytes(32).toString("base64url");
const subject = existing.VAPID_SUBJECT || "mailto:you@example.com";

fs.writeFileSync(
  fnEnv,
  [
    "# Edge Function secrets. Upload with: npm run functions:secrets",
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    "# Contact for push services. Replace with your own email.",
    `VAPID_SUBJECT=${subject}`,
    `CRON_SECRET=${cronSecret}`,
    "",
  ].join("\n"),
);

let local = fs.existsSync(localEnv) ? fs.readFileSync(localEnv, "utf8") : "";
const line = `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`;
local = /^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.*$/m.test(local)
  ? local.replace(/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.*$/m, line)
  : `${local.trimEnd()}\n\n# Web Push public key (npm run push:keys)\n${line}\n`;
fs.writeFileSync(localEnv, local);

const ref = (parse(localEnv).NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
fs.writeFileSync(
  vaultSql,
  [
    "-- Run once in Supabase > SQL Editor. Lets pg_cron call the `daily` Edge Function.",
    "-- To change a value later: select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<new>');",
    `select vault.create_secret('${ref}', 'project_url');`,
    `select vault.create_secret('${cronSecret}', 'cron_secret');`,
    "",
  ].join("\n"),
);

console.log("Wrote supabase/.env.functions, supabase/.vault-setup.sql and NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local");
