/**
 * Money (SPEC §4.5–4.7, §5.4–5.6). All amounts are integer paise. Never floats.
 * Pure functions: the saved split is a frozen snapshot (expense_shares) and is
 * never recomputed from these after saving.
 */
import { addDays } from "./calendar";
import { cookWorkedOn, isPresent, type AwayPeriod, type PresenceMember } from "./presence";
import { scheduledOn, type ScheduledMember } from "./schedule";

export type SplitRule = "all_members" | "present_only" | "per_day_worked" | "custom";
export type ItemKind = "item" | "fee" | "tax" | "discount";

export type ExpenseItem = {
  name: string;
  amountPaise: number;
  kind: ItemKind;
  included: boolean;
  personalMemberId: string | null;
};

// ---------------------------------------------------------------- format / parse

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 50000 → "₹500", 3334 → "₹33.34", 10000000 → "₹1,00,000". */
export function formatINR(paise: number): string {
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const body = rest === 0 ? inr0.format(rupees) : inr2.format(rupees + rest / 100);
  return `${paise < 0 ? "−" : ""}₹${body}`;
}

/** Typed rupees → paise. Accepts "500", "43.2", "1,00,000", "₹64". Null if invalid. */
export function parseRupees(input: string): number | null {
  const v = input.replace(/[₹,\s]/g, "");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Paise → the plain rupee string shown in an input box ("43.20", "100"). */
export const paiseToInput = (paise: number) =>
  paise % 100 === 0 ? String(paise / 100) : `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;

// ---------------------------------------------------------------- splitting

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** base = floor(amount / n); leftover paise one each to the first members in id order. */
export function splitEqual(amount: number, ids: readonly string[]): Record<string, number> {
  return splitWeighted(amount, Object.fromEntries(ids.map((id) => [id, 1])));
}

/** Proportional split by weight; same leftover rule. Zero weights are left out. */
export function splitWeighted(amount: number, weights: Record<string, number>): Record<string, number> {
  const ids = Object.keys(weights)
    .filter((id) => weights[id] > 0)
    .sort(byId);
  const total = ids.reduce((s, id) => s + weights[id], 0);
  const out: Record<string, number> = {};
  if (ids.length === 0 || amount <= 0) {
    for (const id of ids) out[id] = 0;
    return out;
  }
  let given = 0;
  for (const id of ids) {
    out[id] = Math.floor((amount * weights[id]) / total);
    given += out[id];
  }
  for (let i = 0; given < amount; i = (i + 1) % ids.length, given++) out[ids[i]]++;
  return out;
}

export type ShareInput = {
  id: string;
  included: boolean;
  /** A typed amount locks the share. */
  locked: number | null;
  /** Items marked as this person's alone. */
  personal?: number;
  /** Prorating weight (days present). Defaults to 1. */
  weight?: number;
};

export type SplitStatus =
  | { kind: "ok"; total: number }
  | { kind: "remaining"; amount: number }
  | { kind: "over"; amount: number }
  | { kind: "none" };

/**
 * Lock-and-redistribute (SPEC §4.6, §5.5): locked shares stay as typed; the
 * rest of the total is split among unlocked, checked people (personal items
 * first, then the shared remainder by weight).
 */
export function computeShares(
  total: number,
  people: readonly ShareInput[],
): { shares: Record<string, number>; status: SplitStatus; canSave: boolean } {
  const included = people.filter((p) => p.included);
  if (included.length === 0) return { shares: {}, status: { kind: "none" }, canSave: false };

  const shares: Record<string, number> = {};
  const locked = included.filter((p) => p.locked !== null);
  const free = included.filter((p) => p.locked === null);
  for (const p of locked) shares[p.id] = p.locked!;

  const remaining = total - locked.reduce((s, p) => s + p.locked!, 0);
  const personal = free.reduce((s, p) => s + (p.personal ?? 0), 0);
  const pool = remaining - personal;
  const parts = pool > 0 ? splitWeighted(pool, Object.fromEntries(free.map((p) => [p.id, p.weight ?? 1]))) : {};
  for (const p of free) shares[p.id] = (p.personal ?? 0) + (parts[p.id] ?? 0);

  const sum = Object.values(shares).reduce((s, v) => s + v, 0);
  const status: SplitStatus =
    sum === total ? { kind: "ok", total } : sum < total ? { kind: "remaining", amount: total - sum } : { kind: "over", amount: sum - total };
  return { shares, status, canSave: status.kind === "ok" && total > 0 };
}

export function statusText(status: SplitStatus): string {
  switch (status.kind) {
    case "ok":
      return `✓ Shares add up to ${formatINR(status.total)}`;
    case "remaining":
      return `${formatINR(status.amount)} still to assign`;
    case "over":
      return `Shares are ${formatINR(status.amount)} over the total`;
    case "none":
      return "Pick at least one person";
  }
}

/** The amount that is split (ticked items, discounts subtracted) and what stays with the payer. */
export function splitTotal(items: readonly ExpenseItem[], typedTotal: number): { split: number; notSplit: number } {
  if (items.length === 0) return { split: typedTotal, notSplit: 0 };
  const signed = (i: ExpenseItem) => (i.kind === "discount" ? -i.amountPaise : i.amountPaise);
  return {
    split: items.filter((i) => i.included).reduce((s, i) => s + signed(i), 0),
    notSplit: items.filter((i) => !i.included).reduce((s, i) => s + signed(i), 0),
  };
}

// ---------------------------------------------------------------- rules

const flatmateOn = (m: PresenceMember, date: string) =>
  m.role === "flatmate" && m.joined_on <= date && (m.left_on === null || date <= m.left_on);

/** Default people for a category rule on the expense date. Cook and maid never share. */
export function defaultParticipants(
  rule: SplitRule,
  members: readonly PresenceMember[],
  date: string,
  periods: readonly AwayPeriod[],
): string[] {
  const flatmates = members.filter((m) => flatmateOn(m, date));
  const picked =
    rule === "all_members" || rule === "custom" ? flatmates : flatmates.filter((m) => isPresent(m, date, periods));
  return picked.map((m) => m.id);
}

function monthDays(month: string): string[] {
  const out: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysPresentInMonth(member: PresenceMember, month: string, periods: readonly AwayPeriod[]): number {
  return monthDays(month).filter((d) => isPresent(member, d, periods)).length;
}

/** Days in a month the cook or maid is employed and scheduled to work. */
const scheduledDays = (person: ScheduledMember, month: string) =>
  monthDays(month).filter(
    (d) => person.joined_on <= d && (!person.left_on || d <= person.left_on) && scheduledOn(person, d).works,
  );

/**
 * Cook's monthly pay = daily rate × days worked (SPEC §5.4 per_day_worked).
 * Only days in their weekly schedule count; full days of leave on those are unpaid.
 */
export function cookPay(ratePaise: number, cook: ScheduledMember, month: string, periods: readonly AwayPeriod[]) {
  const days = scheduledDays(cook, month);
  const daysWorked = days.filter((d) => cookWorkedOn(cook, d, periods)).length;
  return { daysWorked, days: days.length, totalPaise: ratePaise * daysWorked };
}

export type StaffRole = "cook" | "maid";

/**
 * The cook's or maid's pay for a month across everyone in that role employed in
 * it, e.g. when one cook replaces another mid-month: daily rate × all days worked.
 * `days` counts the days anyone in the role was employed and scheduled. Full days off are
 * unpaid; part days are paid. Null when nobody in the role worked that month.
 */
export function staffPay(
  role: StaffRole,
  ratePaise: number,
  members: readonly ScheduledMember[],
  month: string,
  periods: readonly AwayPeriod[],
) {
  const staff = members.filter((m) => m.role === role);
  const employed = new Set<string>();
  let daysWorked = 0;
  for (const person of staff) {
    // cookPay only looks at employment and full days off, so it fits the maid too.
    const pay = cookPay(ratePaise, person, month, periods);
    if (pay.days === 0) continue;
    daysWorked += pay.daysWorked;
    for (const d of scheduledDays(person, month)) employed.add(d);
  }
  if (employed.size === 0) return null;
  return { daysWorked, days: employed.size, totalPaise: ratePaise * daysWorked };
}

// ---------------------------------------------------------------- explanations

const andList = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export function ruleNote(input: {
  rule: SplitRule;
  awayNames: string[];
  edited?: boolean;
  prorated?: boolean;
  /** Pay by days worked: whose pay (cook by default) and the numbers. */
  pay?: { daysWorked: number; days: number; ratePaise: number; role?: StaffRole };
}): string {
  const { rule, awayNames, edited, prorated, pay } = input;
  let note: string;
  switch (rule) {
    case "custom":
      return "Custom amounts";
    case "all_members":
      note = awayNames.length
        ? `All-members rule: everyone pays, including ${andList(awayNames.map((n) => `${n} (away)`))}`
        : "All-members rule: everyone pays";
      break;
    case "present_only":
      note = awayNames.length
        ? `Present-only rule: ${andList(awayNames)} ${awayNames.length === 1 ? "is" : "are"} away`
        : "Present-only rule: everyone was home";
      break;
    case "per_day_worked":
      {
        const label = pay?.role === "maid" ? "Maid's pay" : "Cook's pay";
        note = pay ? `${label}: ${pay.daysWorked} of ${pay.days} days worked at ${formatINR(pay.ratePaise)}/day` : label;
      }
      note += prorated ? ", split by days each person was home" : ", split among those at home";
      break;
  }
  return edited ? `${note}. Some amounts were set by hand` : note;
}

/** Short reason per share, e.g. "Wheat flour, Harpic, fees" or "₹34 shared + ₹30 curd". */
export function shareReasons(input: {
  items: readonly ExpenseItem[];
  shares: Record<string, number>;
  locked: ReadonlySet<string>;
  personalTotals: Record<string, number>;
}): Record<string, string> {
  const shared = input.items.filter((i) => i.included && !i.personalMemberId);
  const itemNames = shared.filter((i) => i.kind === "item").map((i) => i.name);
  const extras = new Set(shared.filter((i) => i.kind !== "item").map((i) => (i.kind === "fee" ? "fees" : i.kind === "tax" ? "taxes" : "discounts")));
  const names = itemNames.length > 3 ? [...itemNames.slice(0, 2), `${itemNames.length - 2} more`] : itemNames;
  const sharedLabel = [...names, ...extras].join(", ");

  const out: Record<string, string> = {};
  for (const [id, amount] of Object.entries(input.shares)) {
    if (input.locked.has(id)) {
      out[id] = "Set by hand";
      continue;
    }
    const personal = input.personalTotals[id] ?? 0;
    const mine = input.items.filter((i) => i.included && i.personalMemberId === id).map((i) => i.name);
    if (personal > 0) {
      const rest = amount - personal;
      out[id] = rest > 0 ? `${formatINR(rest)} shared + ${formatINR(personal)} ${mine.join(", ")}` : mine.join(", ");
    } else {
      out[id] = sharedLabel || "Equal share";
    }
  }
  return out;
}
