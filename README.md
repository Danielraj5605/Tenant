# Tenant

A PWA for organising one shared flat. Who is home decides the chore rotation, the meal headcount and how shared costs are split. See [SPEC.md](SPEC.md).

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
3. In the Supabase dashboard:
   - **Authentication → Sign In / Providers → Google**: enable it and paste the Google OAuth client ID and secret.
   - **Authentication → URL Configuration**: Site URL `http://localhost:3000`, redirect URL `http://localhost:3000/**`.

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
3. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`.
4. Supabase → Authentication → URL Configuration: Site URL `https://<your-app>.vercel.app`,
   redirect URL `https://<your-app>.vercel.app/**`.

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
| `lib/engine/` | Pure business logic, no database calls. Unit-tested with Vitest. |
| `lib/supabase/` | Browser and server Supabase clients, database types |
| `supabase/migrations/` | Schema, RLS policies and RPC functions |
| `proxy.ts` | Refreshes the auth session; sends signed-out visitors to `/login` |
| `app/(app)/` | Signed-in screens with the bottom navigation |
