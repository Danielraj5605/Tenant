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

## Run

```bash
npm run dev        # http://localhost:3000
npm run check      # type-check + lint + unit tests
npm run build      # production build
```

## Layout

| Path | What |
| --- | --- |
| `lib/engine/` | Pure business logic, no database calls. Unit-tested with Vitest. |
| `lib/supabase/` | Browser and server Supabase clients, database types |
| `supabase/migrations/` | Schema, RLS policies and RPC functions |
| `proxy.ts` | Refreshes the auth session; sends signed-out visitors to `/login` |
| `app/(app)/` | Signed-in screens with the bottom navigation |
