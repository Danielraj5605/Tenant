# Tenant — Product & Technical Specification

Version: draft 1 · 5 Nov 2026 · Owner: Danielraj

This is the single source of truth for building Tenant. It consolidates every decision made during planning. Where this spec and the design mockups disagree, **this spec wins**.

---

## 1. What Tenant is

Tenant is a household app for one shared flat. Its core idea: **who is home on a given day automatically decides the chore rotation, the meal headcount, and how shared costs are split.** One entry ("I'm away Fri–Sun") updates chores, meals and money together.

It is built first for one real flat, then generalised so any flat can sign up.

### 1.1 The flat it is built for

| Who | Count | Uses the app? | Notes |
| --- | --- | --- | --- |
| Flatmates | 6 | Yes | One is admin |
| Long-away flatmate | 1 of the 6 | Yes | Away for the next 3 months (5 Nov 2026 – 5 Feb 2027). Pays **rent and WiFi only** while away |
| Cook | 1 | **No** | Flatmates mark her leave days |
| Maid | 1 | **No** | Flatmates mark her leave days |

### 1.2 Non-goals (do not build)

- **No in-app payments.** No "Settle up", no UPI links, no payment gateway. Money is a ledger that tracks expenses and justifies each split. People pay each other outside the app.
- No app access, logins, WhatsApp or SMS links for the cook or maid.
- No native iOS or Android apps. Ship as a PWA only.
- No paid services. Everything must run on free tiers.

---

## 2. Final decisions

| Topic | Decision |
| --- | --- |
| Platform | PWA (installable from the browser on Android and iPhone) |
| Away flatmate | Pays rent and WiFi; excluded from everything else while away |
| Cook's pay | **No pay for a full day of leave.** If she worked any part of the day, she is paid in full for that day |
| Menu owner | One fixed flatmate, changeable in settings |
| Cook and maid | Tracked as members with no login; any flatmate marks their leave |
| Part-day away | For a single day, pick Morning, Afternoon and/or Night. It only changes the matching meals (breakfast, lunch, dinner); chores and money treat the person as home (decided 2026-11-05) |
| Bill scanning AI | Free tiers only: Gemini Flash primary, Groq Llama 4 Scout fallback |
| Money section | Expense ledger with itemised split justification. No payments |
| Split amounts | The person creating a split sets the total **and can edit each person's share** at creation time |

---

## 3. Core concept: availability is the engine

Every feature reads one question: **is this member present on this date?**

| Event | Chores | Menu | Money |
| --- | --- | --- | --- |
| Flatmate marks a weekend away | Their duties pass to the next present person in rotation | Headcount drops by 1 for those days | Excluded from "present only" splits for those days |
| Cook marked on leave (full day) | No change | Day shows "No cook" with a prompt: order in or cook yourselves | That day is unpaid |
| Cook marked on leave (partial day) | No change | "No cook" only for the meals in the chosen slots | That day is paid in full |
| Flatmate out for part of a day | No change | Not counted for the meals in the chosen slots | No change |
| Maid marked on leave | Cleaning tasks are flagged for flatmates | No change | Per flat setting |
| Flatmate away for months | Skipped in every rotation | Not counted | Pays rent and WiFi only |

When an away period ends, the member rejoins everything automatically. No manual changes.

---

## 4. Features

### 4.1 Members and flat setup
- Admin creates the flat and shares an invite link. Flatmates sign in with Google or an email magic link.
- Cook and maid are added as members with `role = cook | maid` and no `user_id`.
- Admin edits members, the menu owner, and default split rules per category.

### 4.2 Availability
- A calendar where any flatmate marks someone away: start date, end date, full day or partial, optional reason.
- A partial absence is for a single day and names the slots missed: **Morning** (breakfast), **Afternoon** (lunch), **Night** (dinner).
- Short trips and long absences use the same feature.
- Flatmates mark leave for the cook and maid.
- The month view shows coloured dots per day: cook (amber), maid (purple), flatmate (blue). A "Who's away" list sits under the calendar, and long absences get a "Long away" badge.

### 4.3 Chores
- Recurring duties (garbage, kitchen cleaning, water cans, groceries run, and others) each have a rotation order.
- A daily job assigns the next **present** member. Away members are skipped. If nobody is present, the day is skipped.
- Views: "This week" (each chore, today's owner, schedule, who's next) and "Rotation" (ordered list, away members shown as skipped).
- The owner can mark a chore done.
- Menu planning is **not** a rotating chore. It belongs to the fixed menu owner.

### 4.4 Menu and headcount
- The menu owner plans breakfast, lunch and dinner per day.
- Each meal has its own headcount: flatmates present that day and not out for that meal's slot. It is computed, never typed.
- Cook-leave days show "No cook" on the affected meals with two actions: **Order in** or **We'll cook**.
- The Today screen shows today's menu and headcount.

### 4.5 Money (expense ledger)

**Purpose:** track shared expenses and show *why* each person owes what they owe. There are no payments in the app.

**Ledger screen**
- Month summary: total shared spend and **your share** this month.
- A list of expenses showing title, date, payer, source (manual or scanned), total, and how many people share it. Example rows:
  - Groceries from Mithran — ₹200
  - Zepto groceries — ₹500
- Two actions: **Scan a bill** and **New split**.

**Expense detail (tap any expense)**
- **Bill items**: each line item with its price. Items marked personal show who they belong to.
- **Extras**: delivery charge, handling fee, taxes (CGST, SGST, GST %), discounts, each as its own line.
- **Total**.
- **How it was split**: a one-line note on the rule used (for example "Present-only rule: Flatmate 6 is away"), then each person's share with a short reason ("Wheat flour, Harpic, fees" or "₹34 shared + ₹30 curd").

Reference example (Zepto groceries, ₹500, shared by the 5 at home):

| Line | Amount |
| --- | --- |
| Wheat flour 500 g | ₹298 |
| Harpic | ₹195 |
| Delivery charge | ₹5 |
| Handling fee | ₹2 |
| **Total** | **₹500** → ₹100 each × 5 |

### 4.6 New split (manual)
Fields:
1. **What was it for?** (title)
2. **Total amount**, typed by the creator
3. **Paid by** (choose one flatmate)
4. **Each person's share**: one row per member with a checkbox (include or exclude) and an editable amount box

Share-editing rules:
- By default the total is split equally among the checked people.
- Typing an amount for a person **locks** that share. The remaining amount is split equally among the unlocked, checked people.
- Unchecking a person removes them and clears their lock.
- The away flatmate is unchecked by default for present-only categories.
- A status line shows one of: "✓ Shares add up to ₹X", "₹Y still to assign", "Shares are ₹Y over the total", or "Pick at least one person".
- **Save is enabled only when the shares sum exactly to the total.**
- A **Split equally** action clears all locks.
- Optional: add line items manually so the split can be justified the same way as a scanned bill.

### 4.7 Scan a bill (two steps)
**Step 1: items and people**
- Show the bill thumbnail, merchant, date, payer and bill total, plus a check line: "Items add up to the bill total" or a warning.
- Every extracted line (items, fees, taxes) appears as a **checkbox list** with its amount. Ticked items are split. Unticked items are "Not split · stays with payer".
- **People chips**: tap to choose who shares the ticked items. Away members are off by default.
- Button: **Next: check each share**.

**Step 2: each person's share**
- The same editable per-person amount boxes and lock-and-redistribute rules as New split, applied to the total of the ticked items.
- Shows the amount not split (stays with the payer).
- **Save split** is enabled only when the shares sum exactly.
- The flatmate can fix misread item names or amounts before saving. Review is mandatory; scans are never auto-saved.

### 4.8 Today screen
- Date and greeting; avatar button opens flat settings.
- Who's home today (for example "5 of 6"), with away members shown dashed and the date they return.
- Alerts, such as "No cook on Sat 7 Nov — order in or cook yourselves?"
- Your duty today, with a **Mark done** button.
- Today's menu and headcount.
- A money card: **your share this month**, linking to the ledger. No "owe" or "settle" wording.

### 4.9 Notifications (Web Push)
- Daily reminder to whoever has a duty that day.
- Alert to the flat when the cook or maid is marked on leave.
- Weekly prompt: "Away any day next week?"
- On iPhone, push only works after "Add to Home Screen", so onboarding must walk users through installing.

---

## 5. Business rules (implement exactly)

### 5.1 Presence
```
isPresent(member, date) =
  date within [member.joined_on, member.left_on or ∞]
  AND no away_period with full_day = true covers date

isPresentFor(member, date, meal) =
  isPresent(member, date)
  AND no partial away_period on date includes the meal's slot
  (breakfast = morning, lunch = afternoon, dinner = night)
```
Partial absences never change chores or money; they only change meals.
For cook pay, a day counts as "worked" unless an away period with `full_day = true` covers it.

### 5.2 Headcount
```
headcount(date, meal) = count of members with role = 'flatmate' where isPresentFor(member, date, meal)
```

### 5.3 Chore rotation
```
nextAssignee(chore, date):
  start after the last assignee in chore_rotation order
  return the first member where isPresent(member, date)
  if none present → mark the day 'skipped'
```

### 5.4 Split rules (per expense category, overridable per expense)
| Rule | Who shares | Used for |
| --- | --- | --- |
| `all_members` | Every member on the expense date, away or not | Rent, WiFi |
| `present_only` | Members present on the expense date | Groceries, gas, household items |
| `per_day_worked` | Cook's monthly pay = daily rate × days worked; then split present-only | Cook's pay |
| `custom` | Amounts set by the creator | Anything |

The category rule only sets the **default** people and amounts on the New split and Scan screens. The creator can always change people, items and per-person amounts before saving.

### 5.5 Money handling
- Store all money as **integer paise**. Never use floats for money.
- Equal-split rounding: `base = floor(amount / n)`; the leftover paise go one each to the first members in a fixed order (member id order), so shares always sum exactly.
- Lock-and-redistribute: `remaining = total − sum(locked shares)`; split `remaining` equally among the unlocked checked members using the same rounding.
- On save, write the final shares to `expense_shares` (the **split snapshot**). Later changes to members or away dates **never** recompute saved expenses.
- An expense can be edited or re-split only by its creator, and only until it is marked settled. Settled expenses are read-only.

### 5.6 Mid-month returns (setting)
For monthly present-only costs, the default is to prorate by days present (home 10 of 30 days → one third of a share). The flat can switch to full-month splits in settings.

---

## 6. Screens (8)

Design references are in `design/` (see `design/README.md`). Each is a 390×844 mobile artboard.

| # | File | Screen | Key interactions |
| --- | --- | --- | --- |
| 1 | `Main.dc.html` | Today | Mark duty done; links to Menu, Money, Settings |
| 2 | `Availability.dc.html` | Calendar | Month grid with dots; "Who's away" list; **Mark someone away** |
| 3 | `Chores.dc.html` | Chores | "This week" / "Rotation" tabs; away banner; add chore |
| 4 | `Menu.dc.html` | Menu | Week list with headcount; "No cook" card with Order in / We'll cook |
| 5 | `Expenses.dc.html` | Money ledger + expense detail | Tap a row for itemised detail and split justification |
| 6 | `NewSplit.dc.html` | New split | Total, payer, include checkboxes, editable per-person amounts, live status |
| 7 | `ScanBill.dc.html` | Scan bill (2 steps) | Item checkboxes, people chips → editable shares → save |
| 8 | `Members.dc.html` | Flat settings | Members list with roles and badges, default split rules, add flatmate |

Bottom navigation (5 tabs): **Today · Calendar · Chores · Menu · Money**. Settings opens from the avatar on Today.

### 6.1 Design tokens (from the mockups)
| Token | Value |
| --- | --- |
| Font | Manrope (Google Fonts), weights 400–800 |
| Background | `#F5F4EF` |
| Surface (cards) | `#FFFFFF`, radius 16px |
| Ink | `#1C1B19` |
| Muted text | `#5F5E58` |
| Accent (primary) | `#0F6E64`; accent tint `#DCEDEA`; accent dark `#0A4F48` |
| Warning (no cook) | background `#FBEBD9`, text `#6B3A0B` |
| Info (away) | background `#E5EBFA`, text `#2E4A9E` |
| Borders | `#E4E2DA` / `#D6D4CB` |
| Touch targets | ≥ 44px; primary buttons 52px tall, fully rounded |
| Icons | Inline stroke SVG (Lucide-style); no emoji |

---

## 7. Tech stack (all free tiers)

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS | UI and API routes in one project |
| PWA | Serwist (`@serwist/next`) + `app/manifest.ts` | Maintained successor to next-pwa, built for App Router |
| Database | Supabase Postgres with Row Level Security | Relational data; RLS isolates each flat |
| Auth | Supabase Auth: Google sign-in and email magic link | No passwords |
| Storage | Supabase Storage | Bill photos, compressed client-side |
| Jobs | Supabase `pg_cron` → Edge Functions | Vercel Hobby cron runs at most once a day |
| Push | Web Push (VAPID) via the service worker | Works in installed PWAs |
| Bill AI | Gemini Flash (primary), Groq `meta-llama/llama-4-scout-17b-16e-instruct` (fallback) | Free tiers with image input |
| Validation | Zod | Shared client and server schemas |
| Hosting | Vercel Hobby | Free; deploys from GitHub |
| Tests | Vitest (unit), Playwright (end-to-end) | |

Free-tier constraints to respect:
- Supabase Free: 500 MB database, 1 GB storage, and the project pauses after 7 days without activity. Daily use plus the daily `pg_cron` job keep it active.
- Compress bill images to about 200 KB before upload (1600 px long edge, JPEG quality 0.7).

---

## 8. Architecture

```
Phone (PWA: Next.js UI + Serwist service worker)
  ├── reads/writes ──► Supabase (Postgres + RLS, Auth, Storage)
  └── bill photo ───► Vercel API route /api/scan
                          ├── image + JSON schema ──► Gemini Flash (fallback: Groq)
                          └── returns parsed items (client reviews, then saves to Supabase)
Supabase pg_cron (daily, 06:00 flat time) ──► Edge Function
  ├── generate chore assignments
  ├── recompute menu headcount for the next 7 days
  └── send Web Push reminders ──► phones
```

- The client talks to Supabase directly through `supabase-js`, with access enforced by RLS.
- Only bill scanning goes through a server route, so AI keys never reach the browser.
- Pure business logic lives in `lib/engine/` with no database calls, so it is unit-testable.

---

## 9. Data model

All tables carry `flat_id` (except `flats`) and `created_at`. Money columns are integer paise.

| Table | Columns | Notes |
| --- | --- | --- |
| `flats` | id, name, timezone (default `Asia/Kolkata`), menu_owner_id, prorate_monthly (bool, default true) | |
| `members` | id, flat_id, user_id (nullable), name, role (`flatmate`/`cook`/`maid`), is_admin, joined_on, left_on, sort_order | Cook and maid have null user_id |
| `away_periods` | id, member_id, start_date, end_date, full_day (bool, default true), slots (`morning`/`afternoon`/`night`[], partial only), reason, created_by | Read by every feature |
| `chores` | id, flat_id, name, frequency (`daily`/`weekly`/`custom`), days_of_week (int[]), due_time | |
| `chore_rotation` | chore_id, member_id, position | |
| `chore_assignments` | id, chore_id, member_id, due_date, status (`pending`/`done`/`skipped`), done_at | Unique (chore_id, due_date) |
| `menu_days` | id, flat_id, date, breakfast, lunch, dinner, plan (`cook`/`order_in`/`self_cook`) | Headcount computed on read |
| `expense_categories` | id, flat_id, name, default_rule (`all_members`/`present_only`/`per_day_worked`/`custom`) | Seed: Rent, WiFi → all_members; Groceries, Gas, Household → present_only; Cook's pay → per_day_worked |
| `expenses` | id, flat_id, category_id, title, merchant, paid_by (member_id), total_paise, expense_date, source (`manual`/`scan`), bill_image_path, rule_note, created_by, settled (bool) | One row per bill or split |
| `expense_items` | id, expense_id, name, quantity, amount_paise, kind (`item`/`fee`/`tax`/`discount`), included (bool), personal_member_id (nullable), sort_order | The itemised justification. Unticked items: `included = false` |
| `expense_shares` | expense_id, member_id, amount_paise, is_custom (bool), reason | The frozen split snapshot. Sum must equal the split total |
| `push_subscriptions` | id, member_id, endpoint, p256dh, auth | |

Constraints:
- A database check (or trigger) that `sum(expense_shares.amount_paise)` equals the split total (the total of `included` items, or `total_paise` when there are no items).
- RLS: users can read and write only rows for flats they belong to. Only admins edit members, categories and flat settings. Only the creator edits an unsettled expense.

---

## 10. Bill scanning pipeline

1. **Client** compresses the image and uploads it to `bills/<flat_id>/<uuid>.jpg`.
2. **`POST /api/scan`** with `{ imagePath }`. The server downloads the image and calls Gemini Flash with structured JSON output.
3. **Fallback**: on HTTP 429, a 5xx or a timeout of more than 20 s, retry once with Groq Llama 4 Scout using the same prompt.
4. **Validate** with Zod. Check that `sum(items) + fees + taxes − discounts == total` within ₹1. If it doesn't match, return the result with `warning: "total_mismatch"`.
5. **Client** shows Step 1. Nothing is saved until the user presses Save in Step 2. Save writes `expenses`, `expense_items` and `expense_shares` in one transaction.

Response schema:
```ts
const ScanResult = z.object({
  merchant: z.string().nullable(),
  date: z.string().nullable(),            // ISO yyyy-mm-dd
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().nullable(),
    amount: z.number(),                    // rupees, converted to paise server-side
    kind: z.enum(['item', 'fee', 'tax', 'discount']),
  })),
  total: z.number().nullable(),
  warning: z.enum(['total_mismatch']).optional(),
});
```

Prompt essentials: amounts in INR; GST, CGST and SGST lines as `tax`; delivery, handling and packaging as `fee`; keep item names as printed (English or Tamil); return `null` for anything unreadable instead of guessing; output JSON only.

Wrap providers behind a single `scanBill(image): ScanResult` interface so models can be swapped through config.

---

## 11. Build phases

| Phase | Scope | Done when |
| --- | --- | --- |
| 1. Foundation | Next.js + Tailwind + Supabase setup, migrations, RLS, auth, flat creation and invite link, design tokens, bottom nav shell | All 6 flatmates can sign in and join the flat |
| 2. Members and availability | Members screen, cook and maid as no-login members, away periods, calendar, `isPresent` with tests | Marking someone away shows on Calendar and Today |
| 3. Chores, menu, PWA (**v1 launch**) | Rotation, daily `pg_cron` job, menu with computed headcount and "No cook" days, Serwist install, Web Push | The flat uses it for a week with no missed duty caused by absences |
| 4. Money ledger and New split | Categories and rules, expense ledger, expense detail with items and shares, New split with editable per-person shares | A month of rent, WiFi, groceries and cook pay balances to the paisa |
| 5. Bill scanning | Compress, upload, `/api/scan` with fallback, two-step review with item checkboxes, people chips and editable shares | 20 real bills scan, with every misread caught at review |

---

## 12. Test cases (must pass)

**Splits**
1. ₹500 among 5, no locks → ₹100 each.
2. ₹200 among 5, with "You" locked at ₹64 → others get ₹34 each; sum is ₹200.
3. ₹100 among 3 → ₹33.34, ₹33.33, ₹33.33 (leftover paise go to the first member in order).
4. WiFi ₹799 with `all_members` and 6 members, one away → ₹133.17 × 4 and ₹133.16 × 2; the away member is included.
5. Locked shares exceed the total → Save disabled; status shows the amount over.
6. Scanned Zepto bill ₹256, chocolate bar ₹40 unticked, 5 people → ₹216 split at ₹43.20 each; ₹40 stays with the payer.

**Presence and rotation**
7. Member away 14–15 Nov → `isPresent` is false on those dates and true on 13 and 16 Nov.
8. Next in rotation is away → the duty skips to the following present member.
9. Everyone in the rotation away → assignment is `skipped`.
10. Long-away member (5 Nov – 5 Feb) → excluded from groceries and gas, included in rent and WiFi.

**Cook pay**
11. Cook on full-day leave on 7 Nov → 7 Nov is unpaid.
12. Cook on partial-day leave → that day is paid in full.
14. Flatmate out at night on 14 Nov → dinner headcount drops by 1; lunch headcount, chores and present-only splits are unchanged.

**Snapshot**
13. After saving an expense, editing an away period does **not** change its `expense_shares`.

---

## 13. Open questions

- Should the ledger also show net "who owes whom" balances (display only, no payments), or only each person's share per expense and per month?
- Does the away flatmate pay maintenance or other fixed bills, or only rent and WiFi?
- Maid's pay: prorated on leave days like the cook's, or fixed?
- How should a member who leaves the flat for good settle up? (Out of the app, but the ledger may need a "settled" marker.)

---

## 14. Sources used during planning
- Serwist docs: https://serwist.pages.dev/docs/next/getting-started
- Vercel cron limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Supabase free-tier limits: https://makerkit.dev/blog/saas/supabase-pricing
- Gemini API rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Groq vision docs: https://console.groq.com/docs/vision
