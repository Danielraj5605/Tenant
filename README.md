# Tenant

A PWA for organising one shared flat. Who is home decides the chore rotation, the meal headcount and how shared costs are split. See [SPEC.md](SPEC.md).

Live: https://wecohabit.vercel.app

## Features

- **Today**: who is home, today's chores and meals at a glance.
- **Calendar**: mark yourself away (by day or by meal); cook and maid leave shown separately.
- **Chores**: rotation chores that skip people who are away, monthly / every-N-months chores
  (rent, salaries, EB bill) with one owner and hand over, "Plan the menu" as a one-person chore,
  and swapping a turn with a flatmate (they accept or decline).
- **Menu**: weekly breakfast / lunch / dinner plan, with per-meal "Order in" or "We'll cook".
- **Money**: shared expenses split among the people at home, settle-up balances, and bill scanning
  by camera or photo (AI reads the bill).
- **Cook & maid**: their own section with phone numbers, weekly work schedule
  (weekly / alternate / off days, which meals the cook makes), days worked and leave.
- **Notifications**: Web Push outside the app for away periods, join requests, expenses, hand overs,
  chores marked done, swap requests and daily reminders.
- **Installable PWA** that works on phones, with an offline-capable service worker.

## Tech stack

| Area | What |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components, Server Actions, Cache Components), Turbopack |
| UI | [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), Manrope via `next/font` |
| Language | TypeScript 5, [Zod 4](https://zod.dev) for input validation |
| Database | [Supabase](https://supabase.com) Postgres (migrations, RPC functions, RLS on every table), Supabase Storage for bill photos |
| Auth | Own accounts: scrypt-hashed passwords and a signed HTTP-only session cookie (no Supabase Auth) |
| Background jobs | Supabase Edge Functions (Deno) `daily` and `notify`, scheduled by `pg_cron` with secrets in Supabase Vault |
| Push notifications | Web Push with VAPID keys (`web-push`) |
| PWA | [Serwist](https://serwist.pages.dev) service worker, web app manifest |
| Bill scanning | Google Gemini (`gemini-2.5-flash`), with Groq (Llama 4 Scout) as fallback |
| Business logic | Pure engine in `lib/engine` (rotation, presence, calendar, menu, money, swaps), shared with the Edge Functions |
| Testing | [Vitest](https://vitest.dev) unit tests, ESLint, `tsc` type-check, Deno type-check for the Edge Functions |
| Hosting | [Vercel](https://vercel.com) (region `sin1`); push to `main` deploys |

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

### Supabase

1. Link the hosted project (asks for the database password):
   ```bash
   npm run db:link
   ```
2. Apply migrations from `supabase/migrations/`:
   ```bash
   npm run db:push
   ```

### Sign-in

Tenant has its own accounts (no Supabase Auth): usernames and scrypt-hashed passwords in
`public.app_users`, and a signed HTTP-only session cookie (`SESSION_SECRET`). The browser never talks
to Supabase; the server uses `SUPABASE_SECRET_KEY` and checks permissions in code. Every table has
RLS on with no policies, so the publishable/anon key can read nothing. Ten wrong passwords lock an
account for 15 minutes; the flat admin can reset a flatmate's password from Settings → member.

### Push reminders and the daily job (Phase 3)

1. Generate keys (writes only to git-ignored files; re-running keeps existing keys):
   ```bash
   npm run push:keys
   ```
   Then set `VAPID_SUBJECT` in `supabase/.env.functions` to `mailto:<your email>`.
2. Upload the Edge Function secrets and deploy the functions:
   ```bash
   npm run functions:secrets
   npm run functions:deploy
   ```
3. Run `supabase/.vault-setup.sql` once in **Supabase → SQL Editor**. It stores the
   project URL and cron secret that `pg_cron` uses to call the `daily` function.
4. `npm run db:push` applies the `pg_cron` schedules (06:00 IST daily, Sunday 18:00 IST weekly).

To run the daily job by hand (SQL Editor): `select public.call_daily_job('daily');`

Edge Functions import a copy of the engine in `supabase/functions/_shared/engine`.
After changing `lib/engine`, run `npm run engine:sync` (a unit test fails if the copy is stale).

### Bill scanning (Phase 5)

Add to `.env.local` (and to Vercel): `GEMINI_API_KEY` from https://aistudio.google.com/apikey and
`GROQ_API_KEY` from https://console.groq.com/keys. Either one alone works; with both, Groq is the fallback.
Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`), `GROQ_MODEL` (default `meta-llama/llama-4-scout-17b-16e-instruct`).

## Deploy (Vercel Hobby)

1. Push to a private GitHub repo: `gh repo create tenant --private --source . --remote origin --push`
2. On https://vercel.com/new import the repo (framework: Next.js; build command comes from `package.json`).
3. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`,
   `NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`,
   `GEMINI_API_KEY`, `GROQ_API_KEY`.

## Run

```bash
npm run dev        # http://localhost:3000
npm run check      # type-check + lint + unit tests
npm run build      # production build + service worker (public/sw.js)
npm start          # serve the production build; the PWA and push only work here
```

## Layout

| Path | What |
| --- | --- |
| `app/(app)/` | Signed-in screens with the bottom navigation: today, calendar, chores, menu, money, staff, settings |
| `app/login/`, `app/onboarding/` | Sign-in, creating or joining a flat |
| `app/api/scan/` | Bill scanning endpoint |
| `components/` | Shared UI (forms, pickers, push setup, camera, swaps) |
| `lib/engine/` | Pure business logic, no database calls. Unit-tested with Vitest. |
| `lib/auth/` | Password hashing and signed session cookies |
| `lib/supabase/` | Server-only Supabase client and database types |
| `lib/scan/` | Gemini / Groq bill reading with fallback |
| `supabase/migrations/` | Schema, RLS, RPC functions and `pg_cron` schedules |
| `supabase/functions/` | Edge Functions `daily` and `notify`, plus `_shared/engine` (a synced copy of `lib/engine`) |
| `scripts/` | Engine sync, Edge Function type-check, push keys, icons, sample data |
| `proxy.ts` | Sends signed-out visitors to `/login`; every page and action checks the session again on the server |
