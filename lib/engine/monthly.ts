/**
 * Monthly chores: once every N months, due by a day of the month, done by one
 * person (e.g. rent by the 5th, the EB bill every 2 months).
 * Pure functions over plain data; no database access.
 */
import { addDays, shiftMonth } from "./calendar";

export type MonthlyChore = {
  every_months: number;
  day_of_month: number;
  /** yyyy-mm-01 of the first month it's due. */
  start_month: string;
};

const idx = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
};

const lastDayOf = (month: string) => Number(addDays(`${shiftMonth(month, 1)}-01`, -1).slice(8));

/** Is the chore due in this yyyy-mm month? */
export function occursIn(chore: MonthlyChore, month: string): boolean {
  const diff = idx(month) - idx(chore.start_month.slice(0, 7));
  return diff >= 0 && diff % chore.every_months === 0;
}

/** Its due date in a month; a day past the month's end means the last day (31 → 30 Nov). */
export function dueDateIn(chore: MonthlyChore, month: string): string {
  const day = Math.min(chore.day_of_month, lastDayOf(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** The latest month it's due in, on or before `month`; null before the first one. */
export function occurrenceOnOrBefore(chore: MonthlyChore, month: string): string | null {
  const diff = idx(month) - idx(chore.start_month.slice(0, 7));
  if (diff < 0) return null;
  return shiftMonth(month, -(diff % chore.every_months));
}

/** The first month it's due in after `month`. */
export function occurrenceAfter(chore: MonthlyChore, month: string): string {
  const start = chore.start_month.slice(0, 7);
  const diff = idx(month) - idx(start);
  if (diff < 0) return start;
  return shiftMonth(month, chore.every_months - (diff % chore.every_months));
}

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
};

/** "Every month, by the 5th" / "Every 2 months, by the 10th". */
export function monthlyLabel(chore: MonthlyChore): string {
  const every = chore.every_months === 1 ? "Every month" : `Every ${chore.every_months} months`;
  return `${every}, by the ${ordinal(chore.day_of_month)}`;
}

/** Default first month: this month, or next month if this month's due day has passed. */
export function defaultStartMonth(dayOfMonth: number, today: string): string {
  const month = today.slice(0, 7);
  return today > dueDateIn({ every_months: 1, day_of_month: dayOfMonth, start_month: `${month}-01` }, month)
    ? shiftMonth(month, 1)
    : month;
}

export type MonthlyStatus =
  | { kind: "done"; dueDate: string }
  | { kind: "due"; dueDate: string; daysLeft: number }
  | { kind: "overdue"; dueDate: string; daysLate: number };

const daysBetween = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 86_400_000);

/** Due, overdue or done, for one occurrence. */
export function monthlyStatus(dueDate: string, done: boolean, today: string): MonthlyStatus {
  if (done) return { kind: "done", dueDate };
  const left = daysBetween(today, dueDate);
  return left >= 0 ? { kind: "due", dueDate, daysLeft: left } : { kind: "overdue", dueDate, daysLate: -left };
}
