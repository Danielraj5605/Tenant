/** Menu helpers (SPEC §4.4). Headcount itself comes from presence.headcount. */
import { addDays } from "./calendar";
import { MEALS, cookWorkedOn, isPresentFor, type AwayPeriod, type Meal, type PresenceMember } from "./presence";

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const offset = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}

export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

export type CookStatus = {
  /** The cook misses at least one meal. */
  noCook: boolean;
  /** Meals with no cook, in day order. */
  noCookMeals: Meal[];
  /** The day counts as worked for cook pay. */
  paid: boolean;
};

/**
 * Whether the cook is missing on a date, per meal. Full-day leave means
 * "No cook" for every meal and is unpaid; part-day leave means "No cook" only
 * for the meals in its slots, and the day is still paid (SPEC §2, §5.1).
 */
export function cookStatusOn(members: readonly PresenceMember[], date: string, periods: readonly AwayPeriod[]): CookStatus {
  const cooks = members.filter((m) => m.role === "cook" && m.joined_on <= date && (!m.left_on || date <= m.left_on));
  if (cooks.length === 0) return { noCook: false, noCookMeals: [], paid: false };
  const noCookMeals = MEALS.filter((meal) => cooks.every((c) => !isPresentFor(c, date, periods, meal)));
  return {
    noCook: noCookMeals.length > 0,
    noCookMeals,
    paid: cooks.some((c) => cookWorkedOn(c, date, periods)),
  };
}
