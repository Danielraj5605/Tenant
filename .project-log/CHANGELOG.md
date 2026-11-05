# Changelog

## 2026-11-05 — New address: wecohabit.vercel.app

- Production now at https://wecohabit.vercel.app; NEXT_PUBLIC_SITE_URL updated and redeployed. tenant-plum.vercel.app still works.
- cohabit.vercel.app was taken by another Vercel project.
- Seven test names (letscohabit, getcohabit, cohabithq, cohabito, cohabby, cohabiting, ourcohabit) are still attached to the project and must be removed in the Vercel dashboard.

## 2026-11-05 — Deployed to Vercel

- Production: https://tenant-plum.vercel.app (project `tenant`, connected to GitHub `main`: every push deploys).
- Env vars set in Vercel (secrets marked sensitive); `NEXT_PUBLIC_SITE_URL` points at the production URL.
- Checked: /, /login, manifest, service worker; signed-in Today, Calendar, Away form, Chores, Menu, Money, Settings all 200 with no errors.
- Not set: `GROQ_API_KEY` (bill scanning has no fallback).

## 2026-11-05 — Pushed to GitHub

- Branch renamed master → main and pushed to https://github.com/Danielraj5605/Tenant. Secret scan of the tree and history found only placeholders.

## 2026-11-05 — Part-day away (Morning / Afternoon / Night) and breakfast

- Away form: untick "Away the whole day" to pick Morning (breakfast), Afternoon (lunch) and/or Night (dinner). Single day only; Until locks to From.
- Part-day absences only change meals: per-meal headcount and per-meal "No cook". Chores, rotation and present-only splits treat the person as home. Cook part days stay paid.
- Breakfast added to the menu (plan, Menu page, Today).
- Calendar: "Out part of the day: name (night)"; no "Back" date for part days. Alerts and push say "No cook for dinner".
- Migration `20261110000001_away_slots_breakfast.sql` pushed (adds columns only); `daily` and `notify` functions redeployed.
- 144/144 tests; browser check of the full flow (14 checks) passed; test data removed.

## 2026-11-05 — First run fixes

- Pushed the two pending migrations (`bills_storage`, `own_auth`) to Supabase; sign-up failed without `app_users`.
- `.env.local` had the publishable key in `SUPABASE_SECRET_KEY`; the user replaced it with the secret key.
- Fixed the `Date.now()` prerender error on signed-in pages: `currentUserId()` now calls `connection()` first (`lib/auth/server.ts`).

## 2026-11-05 — Project log and test-case audit

- Set up `.project-log/`: status.json, REQUESTS.md, this changelog, `render.mjs` and the status page.
- Filled in Phases 1–5 and the sign-in change from git history.
- Ran `npm run check`: typecheck and lint clean, 131/131 tests pass (12 files).
- Mapped all 13 SPEC §12 cases to passing tests (see status page).
- Known gap: no screenshots for earlier phases.

## 2026-11-05 — Sign-in: Tenant's own accounts (back-filled)

- Username and password sign-in, then Supabase Auth replaced with Tenant's own accounts (`fa73fd0`, `b8fb5d6`).

## 2026-11-05 — Phase 5: Bill scanning (back-filled)

- Scan pipeline with Gemini and Groq fallback, two-step review (`534e590`, `ddc15a6`).

## 2026-11-05 — Phase 4: Money ledger and New split (back-filled)

- Expense ledger, split rules, New split with editable shares (`980a39b`).

## 2026-11-05 — Phase 3: Chores, menu, PWA (back-filled)

- Rotation, daily job, menu headcount, PWA install, Web Push (`4945a59`).

## 2026-11-05 — Phase 2: Members and availability (back-filled)

- Members, away periods, calendar, presence (`25757d5`, `5f18855`, `6ab307d`).

## 2026-11-05 — Phase 1: Foundation (back-filled)

- Project setup, migrations, RLS, flat creation and invite, design tokens, nav shell (`c009fca`).
