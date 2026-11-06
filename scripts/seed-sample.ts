/**
 * Fill a flat with sample data: five flatmates (with logins), a cook and a maid,
 * away periods, chores with rotation history, a menu, and ~2 months of expenses.
 * Shares are computed with the app's own engine, so they match what the UI would save.
 *
 *   npm run seed:sample                 # seed the flat named below (FLAT_ID)
 *   npm run seed:sample -- --remove     # delete the seeded people, and ALL chores,
 *                                       # menu days, away periods and expenses in that flat
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local, and SEED_PASSWORD
 * (8+ characters) for the sample logins, e.g. SEED_PASSWORD=... npm run seed:sample
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "../lib/auth/password";
import { addDays, monthOf } from "../lib/engine/calendar";
import { isPresent, type AwayPeriod, type PresenceMember } from "../lib/engine/presence";
import { isoWeekday, projectAssignments, type Chore } from "../lib/engine/rotation";
import {
  computeShares,
  cookPay,
  daysPresentInMonth,
  defaultParticipants,
  ruleNote,
  shareReasons,
  splitTotal,
  type ExpenseItem,
  type SplitRule,
} from "../lib/engine/money";

const FLAT_ID = process.env.SEED_FLAT_ID ?? "1385ba41-6ec7-4dfe-9767-d522c8e97b7f";
const PASSWORD = process.env.SEED_PASSWORD ?? "";
const JOINED = "2026-08-01";
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const FLATMATES = [
  { username: "madan", name: "Madan" },
  { username: "karthik", name: "Karthik" },
  { username: "rishab", name: "Rishab" },
  { username: "kishore", name: "Kishore" },
  { username: "barani", name: "Barani" },
];
const STAFF = [
  { name: "Lakshmi", role: "cook" as const },
  { name: "Selvi", role: "maid" as const },
];

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

async function remove() {
  const names = [...FLATMATES.map((f) => f.name), ...STAFF.map((s) => s.name)];
  must(await db.from("expenses").delete().eq("flat_id", FLAT_ID), "delete expenses");
  must(await db.from("chores").delete().eq("flat_id", FLAT_ID), "delete chores");
  must(await db.from("menu_days").delete().eq("flat_id", FLAT_ID), "delete menu");
  must(await db.from("away_periods").delete().eq("flat_id", FLAT_ID), "delete away");
  must(await db.from("flats").update({ menu_owner_id: null }).eq("id", FLAT_ID), "clear menu owner");
  must(await db.from("members").delete().eq("flat_id", FLAT_ID).in("name", names), "delete members");
  must(await db.from("app_users").delete().in("username", FLATMATES.map((f) => f.username)), "delete users");
  console.log("Removed sample data from", FLAT_ID);
}

type Member = PresenceMember & { name: string; user_id: string | null; is_admin: boolean };

async function seed() {
  if (PASSWORD.length < 8) throw new Error("Set SEED_PASSWORD (8+ characters) for the sample logins.");
  const flat = must(await db.from("flats").select("*").eq("id", FLAT_ID).single(), "flat");
  const existing = must(await db.from("members").select("*").eq("flat_id", FLAT_ID), "members") as Member[];
  if (existing.some((m) => m.name === "Madan")) throw new Error("Sample data is already there. Run with --remove first.");
  const admin = existing.find((m) => m.is_admin && m.role === "flatmate");
  if (!admin) throw new Error("No admin flatmate in this flat");

  // The admin has lived here since August too, so September bills include them.
  if (admin.joined_on > JOINED) {
    must(await db.from("members").update({ joined_on: JOINED }).eq("id", admin.id), "admin joined_on");
    admin.joined_on = JOINED;
  }

  // ---------------------------------------------------------------- people
  const hash = await hashPassword(PASSWORD);
  const users = must(
    await db
      .from("app_users")
      .insert(FLATMATES.map((f) => ({ username: f.username, display_name: f.name, password_hash: hash })))
      .select("id, username"),
    "app_users",
  ) as { id: string; username: string }[];
  const userId = (u: string) => users.find((x) => x.username === u)!.id;

  const maxOrder = Math.max(0, ...existing.map((m) => (m as unknown as { sort_order: number }).sort_order ?? 0));
  const inserted = must(
    await db
      .from("members")
      .insert([
        ...FLATMATES.map((f, i) => ({
          flat_id: FLAT_ID,
          user_id: userId(f.username),
          name: f.name,
          role: "flatmate",
          is_admin: false,
          joined_on: JOINED,
          sort_order: maxOrder + 1 + i,
        })),
        ...STAFF.map((s, i) => ({
          flat_id: FLAT_ID,
          user_id: null,
          name: s.name,
          role: s.role,
          is_admin: false,
          joined_on: JOINED,
          sort_order: maxOrder + 1 + FLATMATES.length + i,
        })),
      ])
      .select("*"),
    "members insert",
  ) as Member[];
  const members: Member[] = [admin, ...inserted];
  const by = (name: string) => members.find((m) => m.name === name)!;
  const D = admin, M = by("Madan"), K = by("Karthik"), R = by("Rishab"), Ki = by("Kishore"), B = by("Barani");
  const cook = by("Lakshmi"), maid = by("Selvi");
  const flatmates = [D, M, K, R, Ki, B];

  // ---------------------------------------------------------------- away periods
  type Away = AwayPeriod & { reason: string; created_by: string };
  const full = (m: Member, s: string, e: string, reason: string): Away => ({
    member_id: m.id, start_date: s, end_date: e, full_day: true, slots: null, reason, created_by: m.id,
  });
  const part = (m: Member, d: string, slots: ("morning" | "afternoon" | "night")[], reason: string): Away => ({
    member_id: m.id, start_date: d, end_date: d, full_day: false, slots, reason, created_by: m.id,
  });
  const away: Away[] = [
    full(B, "2026-09-01", "2026-11-30", "Back home in Coimbatore"),
    full(M, "2026-09-19", "2026-09-21", "Friend's wedding, Madurai"),
    full(Ki, "2026-10-02", "2026-10-04", "Gandhi Jayanti long weekend"),
    full(R, "2026-10-23", "2026-10-25", "Trip to Pondicherry"),
    full(K, "2026-11-07", "2026-11-10", "Diwali at home"),
    full(R, "2026-11-08", "2026-11-09", "Diwali at home"),
    part(M, TODAY, ["night"], "Office dinner"),
    part(Ki, "2026-11-12", ["morning", "afternoon"], "Early client visit"),
    full(cook, "2026-10-13", "2026-10-13", "Sick"),
    full(cook, "2026-11-08", "2026-11-08", "Diwali"),
    part(cook, "2026-10-26", ["night"], "Family function"),
    full(maid, "2026-10-20", "2026-10-21", "Leave"),
  ];
  must(await db.from("away_periods").insert(away.map((a) => ({ ...a, flat_id: FLAT_ID }))), "away_periods");

  // ---------------------------------------------------------------- chores
  const choreDefs = [
    { name: "Take out trash", frequency: "daily", days_of_week: [], due_time: "21:00", rot: [D, M, K, R, Ki, B] },
    { name: "Clean kitchen counter", frequency: "custom", days_of_week: [1, 4], due_time: "22:00", rot: [M, K, R, Ki, D] },
    { name: "Clean bathroom", frequency: "weekly", days_of_week: [6], due_time: "12:00", rot: [K, R, Ki, D, M, B] },
    { name: "Order water cans", frequency: "custom", days_of_week: [2, 5], due_time: "10:00", rot: [R, Ki, D, M, K] },
    { name: "Water the plants", frequency: "custom", days_of_week: [3, 7], due_time: "08:00", rot: [Ki, D, M] },
  ];
  const chores = must(
    await db
      .from("chores")
      .insert(choreDefs.map((c) => ({ flat_id: FLAT_ID, name: c.name, frequency: c.frequency, days_of_week: c.days_of_week, due_time: c.due_time })))
      .select("id, name, frequency, days_of_week"),
    "chores",
  ) as (Chore & { name: string })[];
  const rotationRows: Record<string, unknown>[] = [];
  const assignmentRows: Record<string, unknown>[] = [];
  const historyFrom = "2026-10-07";
  const historyDays = Math.round((Date.parse(TODAY) - Date.parse(historyFrom)) / 86400000) + 1;
  let n = 0;
  for (const def of choreDefs) {
    const chore = chores.find((c) => c.name === def.name)!;
    def.rot.forEach((m, position) => rotationRows.push({ chore_id: chore.id, member_id: m.id, flat_id: FLAT_ID, position }));
    const plan = projectAssignments(chore, def.rot.map((m) => m.id), null, historyFrom, historyDays, members, away);
    for (const p of plan) {
      n++;
      const past = p.date < TODAY;
      // Most past duties done; an occasional one missed. Today: water cans already ordered.
      const done = p.memberId && (past ? n % 9 !== 0 : def.name === "Order water cans");
      assignmentRows.push({
        chore_id: chore.id,
        flat_id: FLAT_ID,
        member_id: p.memberId,
        due_date: p.date,
        status: !p.memberId ? "skipped" : done ? "done" : "pending",
        done_at: done ? `${p.date}T${def.due_time}:00+05:30` : null,
      });
    }
  }
  must(await db.from("chore_rotation").insert(rotationRows), "chore_rotation");
  must(await db.from("chore_assignments").insert(assignmentRows), "chore_assignments");

  // ---------------------------------------------------------------- menu
  // The flat's weekly menu (Mon–Sat), from the user. Headcounts are computed by the app.
  const WEEK: Record<number, [string, string, string]> = {
    1: ["Idli (15), sambar", "Rice, sambar, cauliflower fry", "Onion uthappam (15), peanut chutney"],
    2: ["Upma", "Vegetable biryani, brinjal dalcha", "Chapathi (25), channa masala"],
    3: ["Pongal, coconut chutney", "Rice, sambar, soya fry", "Onion uthappam (15), garlic chutney"],
    4: ["Poha", "Rice, black channa kolambu, vendakka poriyal", "Chapathi (25), kuruma"],
    5: ["Semiya", "Rice, egg gravy, vazhakkai fry", "Fried rice, egg keema"],
    6: ["Pasta", "Ennai kathirikai kolambu, potato fry", "Sandwich (21)"],
  };
  const SUNDAYS: Record<string, [string, string, string, "cook" | "order_in" | "self_cook"]> = {
    "2026-11-01": ["Masala dosa", "Chicken biryani, raita", "Curd rice, pickle", "cook"],
    "2026-11-08": ["", "", "", "order_in"], // Lakshmi on leave for Diwali
  };
  const menu: [string, string, string, string, "cook" | "order_in" | "self_cook"][] = [];
  for (let d = "2026-10-26"; d <= "2026-11-14"; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    if (WEEK[wd]) menu.push([d, ...WEEK[wd], "cook"]);
    else if (SUNDAYS[d]) menu.push([d, ...SUNDAYS[d]]);
  }
  must(
    await db.from("menu_days").insert(
      menu.map(([date, breakfast, lunch, dinner, plan]) => ({
        flat_id: FLAT_ID, date, plan, breakfast: breakfast || null, lunch: lunch || null, dinner: dinner || null,
      })),
    ),
    "menu_days",
  );

  // ---------------------------------------------------------------- money
  const cats = must(await db.from("expense_categories").select("id, name, default_rule").eq("flat_id", FLAT_ID), "categories") as {
    id: string; name: string; default_rule: SplitRule;
  }[];
  const cat = (name: string) => {
    const c = cats.find((x) => x.name === name);
    if (!c) throw new Error(`No category ${name}`);
    return c;
  };

  type Item = [name: string, rupees: number, opts?: { kind?: ExpenseItem["kind"]; off?: boolean; mine?: Member }];
  type Exp = {
    date: string; category: string; title: string; merchant?: string; paidBy: Member;
    rupees?: number; items?: Item[]; cookRate?: number; settled?: boolean;
  };
  const p = (r: number) => Math.round(r * 100);
  const months = ["2026-09", "2026-10", "2026-11"];
  const exps: Exp[] = [];
  for (const mo of months) {
    exps.push({ date: `${mo}-01`, category: "Rent", title: `Rent ${mo === "2026-09" ? "September" : mo === "2026-10" ? "October" : "November"}`, merchant: "Owner (Mr. Subramaniam)", paidBy: D, rupees: 36000 });
    if (mo !== "2026-11") exps.push({ date: `${mo}-05`, category: "WiFi", title: "ACT Fibernet", merchant: "ACT Fibernet", paidBy: K, rupees: 799 });
  }
  exps.push({ date: "2026-11-05", category: "WiFi", title: "ACT Fibernet", merchant: "ACT Fibernet", paidBy: K, rupees: 799 });
  exps.push(
    { date: "2026-09-12", category: "Gas", title: "Gas cylinder", merchant: "Indane", paidBy: R, rupees: 868.5 },
    { date: "2026-10-16", category: "Gas", title: "Gas cylinder", merchant: "Indane", paidBy: R, rupees: 868.5 },
    { date: "2026-09-06", category: "Groceries", title: "Monthly groceries", merchant: "DMart", paidBy: M, items: [
      ["Ponni rice 25 kg", 1450], ["Toor dal 2 kg", 340], ["Sunflower oil 5 L", 795], ["Wheat flour 5 kg", 285],
      ["Sugar 2 kg", 96], ["Tea powder 500 g", 260], ["Spices pack", 410], ["Shaving foam", 199, { off: true }],
    ] },
    { date: "2026-09-15", category: "Groceries", title: "Vegetables and milk", merchant: "Zepto", paidBy: Ki, items: [
      ["Tomato 2 kg", 78], ["Onion 3 kg", 105], ["Potato 2 kg", 64], ["Milk 6 × 500 ml", 168], ["Curd 1 kg", 70],
      ["Greek yogurt", 60, { mine: Ki }], ["Delivery fee", 25, { kind: "fee" }], ["Handling fee", 9, { kind: "fee" }],
    ] },
    { date: "2026-09-24", category: "Groceries", title: "Vegetables", merchant: "Koyambedu market", paidBy: K, rupees: 642 },
    { date: "2026-09-10", category: "Household", title: "Cleaning supplies", merchant: "Blinkit", paidBy: D, items: [
      ["Harpic 1 L", 189], ["Lizol 975 ml", 205], ["Vim bar × 3", 60], ["Garbage bags", 120], ["Scrub pads", 45],
      ["Discount", 40, { kind: "discount" }],
    ] },
    { date: "2026-09-30", category: "Household", title: "Selvi's pay (September)", paidBy: Ki, rupees: 4000 },
    { date: "2026-09-30", category: "Cook's pay", title: "Lakshmi's pay (September)", paidBy: M, cookRate: 300 },
    { date: "2026-10-04", category: "Groceries", title: "Monthly groceries", merchant: "BigBasket", paidBy: D, items: [
      ["Ponni rice 25 kg", 1490], ["Urad dal 1 kg", 155], ["Toor dal 2 kg", 340], ["Groundnut oil 5 L", 1050],
      ["Ghee 500 ml", 330], ["Masala pack", 380], ["Protein bar", 220, { off: true }], ["Delivery fee", 30, { kind: "fee" }],
    ] },
    { date: "2026-10-11", category: "Groceries", title: "Chicken and eggs", merchant: "Licious", paidBy: R, rupees: 856 },
    { date: "2026-10-18", category: "Groceries", title: "Vegetables and milk", merchant: "Zepto", paidBy: M, items: [
      ["Tomato 2 kg", 84], ["Onion 3 kg", 111], ["Beans 1 kg", 90], ["Milk 6 × 500 ml", 168], ["Bread", 45],
      ["Amul curd", 30, { mine: K }], ["Delivery fee", 25, { kind: "fee" }], ["GST on fees", 5, { kind: "tax" }],
    ] },
    { date: "2026-10-27", category: "Groceries", title: "Snacks for Diwali", merchant: "Sri Krishna Sweets", paidBy: Ki, rupees: 1240 },
    { date: "2026-10-20", category: "Household", title: "Gas stove service", merchant: "Local mechanic", paidBy: K, rupees: 450 },
    { date: "2026-10-31", category: "Household", title: "Selvi's pay (October)", paidBy: D, rupees: 4000 },
    { date: "2026-10-31", category: "Cook's pay", title: "Lakshmi's pay (October)", paidBy: M, cookRate: 300 },
    { date: "2026-11-02", category: "Groceries", title: "Monthly groceries", merchant: "DMart", paidBy: K, items: [
      ["Ponni rice 25 kg", 1490], ["Toor dal 2 kg", 350], ["Sunflower oil 5 L", 810], ["Rava 1 kg", 62],
      ["Coffee powder 500 g", 290], ["Biscuits", 140], ["Face wash", 245, { off: true }],
    ] },
    { date: "2026-11-04", category: "Household", title: "Light bulbs and extension box", merchant: "Amazon", paidBy: R, rupees: 699 },
    { date: "2026-11-05", category: "Groceries", title: "Vegetables and milk", merchant: "Zepto", paidBy: D, items: [
      ["Tomato 2 kg", 80], ["Onion 3 kg", 108], ["Brinjal 1 kg", 56], ["Milk 6 × 500 ml", 168], ["Paneer 200 g", 95],
      ["Delivery fee", 25, { kind: "fee" }],
    ] },
  );
  for (const e of exps) e.settled = e.date < "2026-10-15";

  const userOf = (m: Member) => m.user_id!;
  for (const e of exps.sort((a, b) => a.date.localeCompare(b.date))) {
    const category = cat(e.category);
    const rule = category.default_rule;
    const items: ExpenseItem[] = (e.items ?? []).map(([name, rupees, o]) => ({
      name, amountPaise: p(rupees), kind: o?.kind ?? "item", included: !o?.off, personalMemberId: o?.mine?.id ?? null,
    }));
    const signed = (i: ExpenseItem) => (i.kind === "discount" ? -i.amountPaise : i.amountPaise);
    let total = items.length ? items.reduce((s, i) => s + signed(i), 0) : p(e.rupees ?? 0);
    const month = monthOf(e.date);
    let cookInfo;
    if (rule === "per_day_worked") {
      cookInfo = { ...cookPay(p(e.cookRate!), cook, month, away), ratePaise: p(e.cookRate!) };
      total = cookInfo.totalPaise;
    }
    const { split } = splitTotal(items, total);
    const participants = defaultParticipants(rule, members, e.date, away);
    const weighted = rule === "per_day_worked" && flat.prorate_monthly;
    const personalTotals: Record<string, number> = {};
    for (const i of items) if (i.included && i.personalMemberId) personalTotals[i.personalMemberId] = (personalTotals[i.personalMemberId] ?? 0) + signed(i);
    const { shares, canSave } = computeShares(
      split,
      participants.map((id) => ({
        id, included: true, locked: null, personal: personalTotals[id] ?? 0,
        weight: weighted ? daysPresentInMonth(members.find((m) => m.id === id)!, month, away) : 1,
      })),
    );
    if (!canSave) throw new Error(`Shares don't add up for ${e.title} ${e.date}`);
    const awayNames = flatmates
      .filter((m) => m.joined_on <= e.date && !isPresent(m, e.date, away))
      .map((m) => m.name);
    const note = ruleNote({ rule, awayNames, prorated: weighted, cook: cookInfo });
    const reasons = shareReasons({ items, shares, locked: new Set(), personalTotals });

    const id = must(
      await db.rpc("save_expense", {
        p_user_id: userOf(e.paidBy),
        p: {
          category_id: category.id,
          title: e.title,
          merchant: e.merchant ?? null,
          paid_by: e.paidBy.id,
          total_paise: total,
          expense_date: e.date,
          source: items.length ? "scan" : "manual",
          bill_image_path: null,
          rule_note: note,
          items: items.map((i) => ({
            name: i.name, quantity: null, amount_paise: i.amountPaise, kind: i.kind, included: i.included,
            personal_member_id: i.personalMemberId,
          })),
          shares: Object.entries(shares).map(([member_id, amount_paise]) => ({
            member_id, amount_paise, is_custom: false, reason: reasons[member_id] ?? null,
          })),
        },
      }),
      `save_expense ${e.title}`,
    ) as string;
    if (e.settled) must(await db.from("expenses").update({ settled: true }).eq("id", id), "settle");
  }

  console.log(
    `Seeded ${FLAT_ID}: ${inserted.length} members, ${away.length} away periods, ${chores.length} chores ` +
      `(${assignmentRows.length} duties), ${menu.length} menu days, ${exps.length} expenses.`,
  );
  console.log(`Logins: ${FLATMATES.map((f) => f.username).join(", ")} (password from SEED_PASSWORD)`);
}

(process.argv.includes("--remove") ? remove() : seed()).catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
