/** Menu helpers (SPEC §4.4). Headcount itself comes from presence.headcount. */
import { addDays } from "./calendar";
import { MEALS, cookWorkedOn, isPresentFor, type AwayPeriod, type Meal } from "./presence";
import { scheduledFor, scheduledOn, type ScheduledMember } from "./schedule";

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
 * Whether the cook is missing on a date, per meal. Days and meals off in the
 * weekly schedule count as no cook, and an off day isn't paid. Full-day leave means
 * "No cook" for every meal and is unpaid; part-day leave means "No cook" only
 * for the meals in its slots, and the day is still paid (SPEC §2, §5.1).
 */
export function cookStatusOn(members: readonly ScheduledMember[], date: string, periods: readonly AwayPeriod[]): CookStatus {
  const cooks = members.filter((m) => m.role === "cook" && m.joined_on <= date && (!m.left_on || date <= m.left_on));
  if (cooks.length === 0) return { noCook: false, noCookMeals: [], paid: false };
  // A meal has no cook when every cook is on leave for it or isn't scheduled to cook it.
  const noCookMeals = MEALS.filter((meal) =>
    cooks.every((c) => !isPresentFor(c, date, periods, meal) || !scheduledFor(c, date, meal)),
  );
  return {
    noCook: noCookMeals.length > 0,
    noCookMeals,
    paid: cooks.some((c) => scheduledOn(c, date).works && cookWorkedOn(c, date, periods)),
  };
}

export type DayPlan = "cook" | "order_in" | "self_cook";
type PlannedDay = { plan?: DayPlan | null; meal_plans?: Partial<Record<Meal, DayPlan>> | null } | null | undefined;

/** Order in / We'll cook for one meal: its own choice, else the day's. */
export function mealPlanOf(day: PlannedDay, meal: Meal): DayPlan {
  return day?.meal_plans?.[meal] ?? day?.plan ?? "cook";
}

/** Each meal's plan for a day. */
export const mealPlans = (day: PlannedDay): Record<Meal, DayPlan> =>
  Object.fromEntries(MEALS.map((m) => [m, mealPlanOf(day, m)])) as Record<Meal, DayPlan>;

/**
 * Sets the plan for some meals, keeping the others. When every meal ends up
 * the same, the day's plan follows, so older screens and alerts agree.
 */
export function withMealPlans(day: PlannedDay, meals: readonly Meal[], plan: DayPlan) {
  const next: Record<Meal, DayPlan> = { ...mealPlans(day) };
  for (const m of meals) next[m] = plan;
  const same = MEALS.every((m) => next[m] === next.breakfast);
  return { meal_plans: next, plan: same ? next.breakfast : (day?.plan ?? "cook") };
}
