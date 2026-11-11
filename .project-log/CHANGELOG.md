# Changelog

## 2026-11-11 — Audit fixes

- Styled 'Page not found' and in-app 'Not found' pages with Go to Today.
- Monthly jobs whose person has left: no new turns, a clear note on the card, anyone can hand over the open turn; chores can't be given to people who have left.
- Non-owners opening the menu editor see why they can't plan.
- daily redeployed; app deployed a2a551d; checked live.

## 2026-11-11 — Full app audit (read-only)

- All checks pass; 27 routes × 2 widths load clean; 147 links OK; 28 interactions pass; no data changed.
- Found: plain default 404 page; monthly chores can stay with a departed owner; menu planning admin-only without a menu owner (silent redirect).

## 2026-11-11 — Scheduled jobs fixed

- The 6 am daily job and the Sunday prompt had failed on every run since 6 Nov (missing Vault values project_url and cron_secret). Added them on production; a run through the cron path now returns 200.

## 2026-11-11 — Notify when a chore is done

- Marking a chore done notifies every other flatmate; Undo sends nothing.
- Fixed a crash in the first deploy; added npm run functions:check (Deno type-check) and made functions:deploy run it.
- notify redeployed; live test: 'Take out trash done · Rishab did it today.' displayed on a test device.

## 2026-11-11 — Notifications outside the app

- Turning on now works in desktop and Android browsers (the old check said 'installed app only'); 0 devices had ever subscribed.
- Today prompt, Settings 'Send a test notification'.
- New alerts: new split with your share, monthly job 2 days before and when overdue, job handed to you.
- notify and daily Edge Functions redeployed; app deployed 0e8b1d4. Live test: notification displayed by the browser.

## 2026-11-11 — Away edits: confirmation and reasons

- Saving looked like 'nothing happens' (Kishore's reason did change). Now a 'Saved…' notice after adding, editing or removing away days, and reasons show in the day panel.
- Deployed d44e292; checked live.

## 2026-11-11 — Calendar: cook & maid apart; Default splits removed

- Calendar: 'Flatmates away' and a separate 'Cook & maid leave' card; the day panel groups the cook and maid separately.
- Settings: Default splits card removed; categories keep their current rules.
- Deployed bcaeb04 and b67c26f; checked live as Madan at 375/768/1440.

## 2026-11-11 — Scan a bill: camera on every screen

- 'Take a photo' was hidden on screens 1024 px and wider since 7 Nov; it's back everywhere.
- Phones and tablets: native camera. Laptops and desktops: in-app camera with live preview; clear message if the camera is blocked or missing.
- Deployed 0974d53; tested live with a fake camera at 1440/768/375, a touch phone and a denied permission. Nothing saved.

## 2026-11-10 — Monthly chores and hand over

- 'Monthly' chores: every N months, due by a day, first month, one person (rent, salaries, EB bill every 2 months).
- Turn per cycle: Due / Overdue / Done and Next; Mark done; Hand over just this time or from now on; away-on-due-date hint. 'Your monthly jobs' on Today.
- Fixed: the chore form no longer clears after a refused save.
- Migration 20261118000001 (applied to production). Daily job unchanged (already skips monthly chores).
- E2E on dev through the UI, test chores deleted afterwards. 198/198 tests.
- Deployed 18560b6 (Vercel: success); live pages checked at 375/768/1440.

## 2026-11-10 — Cook & maid weekly schedule

- Per weekday: Weekly / Alternate (this or next week) / Off; the cook also picks meals. Set on the cook's or maid's edit page by any flatmate.
- Drives No cook on Menu, Today and Calendar, pay by days worked (scheduled days only) and the Cook & maid page (week strip, notes, Day off).
- Migration 20261117000001: members.work_schedule (applied to production).
- E2E on dev through the UI, then reset to every day. 189/189 tests.
- Deployed 7ea987a (Vercel: success); live pages checked at 375/768/1440.

## 2026-11-10 — Deployed Cook & maid page

- Vercel deploy of c5e9223 succeeded. Live check signed in as Madan: /staff, /settings and /today load at 375/768/1440, no sideways scroll.

## 2026-11-10 — Cook & maid page

- New /staff page, separate from the flatmates: per person, today's status, tap-to-call phone, days worked so far, full and part days of leave, and the month's leave list; month switcher.
- Any flatmate can add, edit and mark leave; removing stays admin-only. Settings lists only flatmates, with a Cook & maid link; Today has a Cook & maid card.
- Migration 20261116000001: optional phone column on members (applied to production).
- WiFi 'only people at home' request dropped at the user's request.
- Checked as a non-admin at 375/768/1440. 172/172 tests, typecheck and lint pass.

## 2026-11-10 — Deployed UI polish 4–6

- Pushed 78ed7c6, c6ad1ec and 97260d0 (deploy 97260d0). Re-run on the live site: Settings/sign-in/onboarding 33/33, New split 28/28, remaining forms 40/40 (including a real bill read and saved).

## 2026-11-10 — UI polish 6: remaining forms

- Scan a bill review step: step indicator, cards, two columns on desktop, sticky Splitting + Next bar on phones.
- Single chore, away, member and day-menu forms in a card; outlined chosen person in 'Who is away?'.
- Fixed: scan review step wider than a phone screen; all two-column pages now use grid-cols-1 below desktop.
- Test fix: 'no sideways scroll' now compares with the real screen width (phone emulation zooms out instead of scrolling).
- E2E: 40/40 incl. a real bill read and saved; the other six suites pass. 162/162 unit tests.

## 2026-11-10 — UI polish 5: New split form

- Three cards (Details, Line items, Each person's share); two columns on desktop with the shares card in view; sticky status + Save bar on phones.
- Fixed: shares legend not labelling its group; desktop Save also showing on phones; payer chip avatar contrast.
- E2E on a production build: 28/28 incl. a real save checked in the database; the other five suites pass. 162/162 unit tests.

## 2026-11-09 — UI polish 4: Settings, sign-in and onboarding

- Settings: two columns on desktop, grouped into the flat, 'How the flat runs' and 'You'; members count pill; page-shaped loading placeholder.
- Sign-in: teal brand panel beside the form on desktop; phone layout unchanged.
- Onboarding: centred column, 'Start a new flat' and 'Join' as two cards.
- E2E on a production build: 33/33 (incl. a real join request accepted by the admin); earlier suites still pass. 162/162 unit tests.

## 2026-11-09 — UI polish 3: Menu and Money

- Menu: pill week switcher with days-planned count, day cards with one header row (date, home pill, Plan/Edit), two columns on desktop.
- Money: two-column desktop layout, date tiles, your share on every bill row, bill count on the totals.
- Bill detail: Total and Your share up top, items and split side by side on desktop.
- Page-shaped loading placeholders for Menu and Money. New split and Scan forms unchanged.
- E2E on a production build with a seeded throwaway flat: 31/31; the other three suites still pass. 162/162 unit tests.
- Deployed with cd35b4b; re-run on the live site: 31/31.

## 2026-11-09 — UI polish 2: Calendar and Chores

- Calendar: two columns on desktop; day panel with home pill, no-cook row, one row per away person, Mark someone away; month list with count.
- Chores: lighter cards (two columns on desktop), Today row with To do / Done pill, 4-day Who's next strip, outlined highlights for your own turns.
- Page-shaped loading placeholders for Calendar and Chores.
- E2E on a production build with a seeded throwaway flat: 38/38; Edit chores still 38/38. 162/162 unit tests.
- Deployed with 70f1172; re-run on the live site: 38/38.

## 2026-11-09 — Edit all chores on one screen

- New `/chores/edit`: every chore's name, days, time and rotation on one screen; add and delete (with Undo); one Save.
- `saveAllChores` server action: validates all chores first (per-chore errors), checks chore and member ownership, then writes.
- Chores page: 'Edit chores' button, saved notice, labelled pencil Edit on each chore.
- E2E on a production build (throwaway flat): 38/38. 162/162 unit tests.
- Deployed with a815730; re-run on the live site: 38/38.

## 2026-11-09 — Plan the whole week's menu on one screen

- Request: "edit option to change the chores and add menu for the entire week, easy option". Split into two sections: week menu, then chores.
- New `/menu/week`: 7 days × 3 meals, one Save; Copy last week, Use usual menu, Clear (with Undo); past days read-only.
- New table `menu_templates` (migration `20261115000001`, pushed by the user) for the flat's usual menu.
- `saveWeek` server action: owner/admin only, writes days from today on, leaves `plan` alone, optionally saves the usual menu.
- E2E on a production build (throwaway flat): 38/38. 162/162 unit tests.
- Deployed with a815730; re-run on the live site: 38/38.

## 2026-11-07 — Upload a bill photo or PDF (read only)

- Scan a bill: "Take a photo" (camera) and "Upload a photo or PDF" (gallery/files); drop zone on desktop.
- `/api/scan` accepts JPEG or PDF (checked by content, PDF ≤ 4 MB); `scanBill(bytes, mime)` sends PDFs to Gemini only.
- Bills are no longer stored (user's choice): no storage upload, scanned expenses save without `bill_image_path`. No migration needed.
- E2E locally: sample PDF and PNG bill both read correctly to the review step; nothing saved. 162/162 tests.

## 2026-11-07 — UI polish 1: shared pieces, navigation and Today

- Request: "improve the UI, good and aesthetic". User chose to polish the current look (Manrope, cream, teal) over a new direction. Planned in 4 sections.
- Today: pending duty is the focal teal block (white Mark done); done duties become a quiet row with Undo. Who's home pill, divided menu rows with headcount pills, share and Mark away as two tiles, alerts share one component.
- Navigation: bottom bar on phone and tablet; left rail with Settings at 1024 px+. Wider column on tablet; Today goes two-column on desktop (`data-wide`).
- New shared pieces in `components/ui.tsx` (SectionHeading, Pill, Skeleton, `inverse` buttons) and `components/skeletons.tsx`; loading screens match the page shape.
- Fix: global focus ring moved into `@layer base` so components can override it (white ring on the teal block).
- Checked locally at 375/768/1440: Mark done → Undo, keyboard focus, no sideways scroll. Typecheck, lint, 162/162 tests, production build pass. Not committed or deployed yet.

## 2026-11-06 — Maid's pay by days worked

- Migration `20261114000001_maid_pay.sql` (pushed): `expense_categories.staff_role`; Cook's pay marked cook; "Maid's pay" (pay by days worked, maid) added to every flat and to new flats.
- Engine: `cooksPay` → `staffPay(role, …)`; rule note says "Maid's pay: 28 of 30 days worked at ₹150/day". 2 new tests (162/162).
- Split form: "The maid worked X of Y days" with the daily-rate helper. Settings rule label: "Pay by days worked".
- E2E on a production build: 9/9.

## 2026-11-06 — Admin and notification gaps

- Migration `20261113000001_hand_over_admin_usual_skips.sql` (pushed): `members.usual_skips`, `hand_over_admin` RPC.
- Join requests push the admin: `notify` accepts `{ joinRequestId }`; the request action calls it with `after()`. `notify` and `daily` redeployed.
- Edge Function secrets (VAPID keys, CRON_SECRET) were never set on the live project: both functions crashed on start, so no push had ever been sent. Uploaded with `npm run functions:secrets`; both start now.
- Settings: "My meals" (usually skip breakfast/lunch/dinner); member page: "Make X the admin" with confirm.
- Headcount leaves out people who usually skip that meal (2 new tests; engine synced to Edge Functions).
- E2E on a production build: 12/12. 160/160 unit tests.

## 2026-11-06 — First-run guidance and Menu at today

- New `components/get-started.tsx`: admin checklist on Today (flatmates, cook/maid, a chore, this week's meals), ticks from real data, hides when done. Replaces the old "Add flatmates" link in Who's home.
- Today's menu: "Plan today's meals" for the menu owner (or the admin when there is none) until something is planned.
- Menu: on the current week, earlier days fold under "Earlier this week (N days)" and Today is the first card. Admin's note: "You plan meals until you pick a menu owner in Settings."
- E2E on a production build: 15/15. 158/158 unit tests.

## 2026-11-06 — Flow fixes from the audit

- #1 Sign-up redirects straight to /onboarding; new `app/error.tsx` (app-styled, one auto-retry per 15 s, Try again / Go to Today).
- #2 Chore form: rotation fieldset `min-w-0` (fieldsets don't shrink by default); #8 options renamed Daily / Weekly / Some days.
- #3 Today: cook alerts state the decided plan ("ordering in" / "you're cooking") and open that week's menu; alerts skip staff who have left. Menu shows "Ordering in" / "We're cooking" on decided days.
- #6 Away save: leave alert sent with `after()` and only for cook/maid. ~3.7 s → ~0.7–1.2 s.
- #7 Settings: a part-day absence isn't drawn as away.
- Cook's pay: new `cooksPay` (3 tests) counts every cook employed that month. Lakshmi marked as left 5 Nov; Mary is the cook.
- E2E on a production build: 12/12 functional checks. 158/158 unit tests.

## 2026-11-06 — Flow audit

- Walked every journey on the live site at phone size as a new person and as Madan; screenshots in `.project-log/shots/flow-audit/`.
- 8 findings, ranked: sign-up error page and detour; chore form overflow; Today asking about a cook day that's already planned; no first-run guidance; Menu opening on Monday; slow away save; part-day avatars; chore options wrapping.
- No code changed in this section.

## 2026-11-06 — Own-data permissions, chores banner, Barani back 20 Nov

- New `lib/engine/permissions.ts` (7 tests): away days, splits, duties; admin overrides.
- Away: form offers only people you may mark; someone else's period opens read-only; `saveAway`/`deleteAway` refuse otherwise.
- Migration `20261112000001_admin_overrides.sql` (pushed): admin may edit, settle and delete any split and mark any duty. Admin sees "Mark done for <name>".
- Chores banner: only full-day absences (part-day ones only change meals).
- Today: tapping an away flatmate opens their away period.
- Barani's away period now ends 19 Nov (back 20 Nov); seed script updated.
- E2E on a production build: 17/17, including a forged "mark someone else away" request that the server refuses. Test users and flats removed. 155/155 unit tests.

## 2026-11-06 — Members admin: flat code, join requests, removing members

- Migration `20261111000001_flat_code_join_requests.sql` (pushed): `flats.flat_code`, `join_requests`, RPCs `request_to_join`, `decide_join_request`, `remove_member`. Dropped `join_flat` and `invite_preview`.
- Onboarding: "Ask to join" with flat code + name; waiting card reloads every 15 s and has Cancel; declined requests are shown.
- Settings (admin): join requests with Accept / Decline, flat code with Copy / Share, Remove on each member page (confirm step), cook/maid role switch. Today shows "X wants to join".
- Fixed: creating a flat bounced back to onboarding (stale 60 s tab cache from the speed change); now a full page load to Settings.
- Fixed: old `/join/<code>` links now redirect to onboarding via next.config.
- End-to-end on a production build: 22/22 checks (create, wrong code, request, accept, auto-refresh in, remove with history, decline, cancel, rejoin, staff edit and delete, no self-remove, old link). Test users and flat removed. 148/148 unit tests.

## 2026-11-06 — Faster pages and staying signed in

- Cause: functions ran in iad1 (US East) while Supabase is in ap-southeast-1 (Singapore), ~220 ms per query, several queries per page in a row.
- `vercel.json` regions → sin1. `getFlatContext` and `loadChoreWeek` now query in parallel.
- `staleTimes.dynamic = 60`: a visited tab is reused for a minute; saves still revalidate at once.
- Sliding sessions: 180 days, renewed by the proxy on use (3 new tests, 147/147 pass).
- Live from India: full page 1.5–2.6 s → 0.6–0.75 s; tab first tap ~0.35 s, revisit ~0.05 s. Sign-in survives a browser restart.

## 2026-11-06 — Sample data

- New `scripts/seed-sample.ts` (`npm run seed:sample`, `-- --remove` to undo). Shares are computed with the app's own engine. Logins need `SEED_PASSWORD`.
- Seeded C2 102: 5 flatmates with logins (shared sample password, not logged here), cook Lakshmi, maid Selvi; Barani away 1 Sep – 30 Nov.
- 12 away periods (incl. part-day and cook/maid leave), 5 chores with 62 duties since 7 Oct, menu 26 Oct – 14 Nov from the user's weekly Mon–Sat menu (piece counts kept, headcounts left to the app), 24 expenses Sep – Nov (Sep and early Oct settled).
- Checked live at 375/768/1440 as Madan: Today, Calendar, Money, Chores, Menu, Settings load with no errors. `npm run check` passes.
- Found: the Chores banner calls part-day absences "away" (text only).

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
