/** Menu helpers (SPEC §4.4). Headcount itself comes from presence.headcount. */
import { addDays } from "./calendar";
import { cookWorkedOn, isPresent, type AwayPeriod, type PresenceMember } from "./presence";

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}

export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/**
 * Whether the cook is missing on a date. Any leave (full or partial) means
 * "No cook" for both lunch and dinner; only full-day leave is unpaid.
 */
export function cookStatusOn(
  members: readonly PresenceMember[],
  date: string,
  periods: readonly AwayPeriod[],
): { noCook: boolean; paid: boolean } {
  const cooks = members.filter((m) => m.role === "cook" && m.joined_on <= date && (!m.left_on || date <= m.left_on));
  if (cooks.length === 0) return { noCook: false, paid: false };
  return {
    noCook: cooks.every((c) => !isPresent(c, date, periods)),
    paid: cooks.some((c) => cookWorkedOn(c, date, periods)),
  };
}
