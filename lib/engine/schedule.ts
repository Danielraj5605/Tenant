/**
 * The cook's and maid's weekly work schedule: which weekdays they come, every
 * week or alternate weeks, and (for the cook) which meals they cook.
 * Pure functions over plain data; no database access.
 *
 * Kept out of presence.ts on purpose: presence.ts is copied into the Edge
 * Functions, which don't need the schedule.
 */
import { addDays, daysInclusive } from "./calendar";
import { MEALS, type Meal, type PresenceMember } from "./presence";

export type DayMode = "every" | "alternate" | "off";

export type DayPlan = {
  mode: DayMode;
  /** Cook only: meals cooked that day. The maid's are always all three. */
  meals: Meal[];
  /** Alternate weeks only: a date (on this weekday) that is a working day. */
  anchor: string | null;
};

/** Monday first: index 0 = Monday … 6 = Sunday. Null means every day, every meal. */
export type WorkSchedule = DayPlan[];

export type ScheduledMember = PresenceMember & { work_schedule?: WorkSchedule | null };

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const everyDay = (): WorkSchedule =>
  WEEKDAYS.map(() => ({ mode: "every" as const, meals: [...MEALS], anchor: null }));

/** Is this alternate-weeks day a working week? Works for dates before the anchor too. */
function alternateWorks(anchor: string, date: string): boolean {
  const weeks = Math.round((daysInclusive(anchor, date) - 1) / 7);
  return weeks % 2 === 0;
}

export type DayWork = { works: boolean; meals: readonly Meal[] };

/** What the schedule says about a date (ignores leave and employment). */
export function scheduledOn(member: ScheduledMember, date: string): DayWork {
  const plan = member.work_schedule?.[weekdayIndex(date)];
  if (!plan) return { works: true, meals: MEALS };
  const meals = member.role === "cook" ? MEALS.filter((m) => plan.meals.includes(m)) : MEALS;
  const works =
    plan.mode === "every" || (plan.mode === "alternate" && plan.anchor !== null && alternateWorks(plan.anchor, date));
  return works && meals.length ? { works: true, meals } : { works: false, meals: [] };
}

/** Scheduled to cook (or, for the maid, to work) a given meal. */
export const scheduledFor = (member: ScheduledMember, date: string, meal: Meal) => scheduledOn(member, date).meals.includes(meal);

/** The next `n` dates on a weekday, from `from` (inclusive). For picking an alternate-weeks anchor. */
export function nextOnWeekday(index: number, from: string, n = 2): string[] {
  const first = addDays(from, (index - weekdayIndex(from) + 7) % 7);
  return Array.from({ length: n }, (_, i) => addDays(first, i * 7));
}

/** Moves an anchor to its next working date on or after `from`, so the form can offer it. */
export function nextWorkingOn(anchor: string, from: string): string {
  const [a, b] = nextOnWeekday(weekdayIndex(anchor), from, 2);
  return alternateWorks(anchor, a) ? a : b;
}

const mealList = (meals: readonly Meal[]) => {
  const names = meals.map((m) => m.toLowerCase());
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

export type DayChip = { short: string; day: string; state: "works" | "part" | "alternate" | "off" };

/** One chip per weekday for the week strip on the Cook & maid page. */
export function weekStrip(member: ScheduledMember): DayChip[] {
  return WEEKDAYS.map((day, i) => {
    const plan = member.work_schedule?.[i];
    const short = WEEKDAYS_SHORT[i];
    if (!plan) return { short, day, state: "works" };
    const meals = member.role === "cook" ? plan.meals : MEALS;
    if (plan.mode === "off" || meals.length === 0) return { short, day, state: "off" };
    if (plan.mode === "alternate") return { short, day, state: "alternate" };
    return { short, day, state: meals.length < MEALS.length ? "part" : "works" };
  });
}

/**
 * Plain-language notes for days that aren't a normal full day, e.g.
 * "Sun: alternate weeks (next 15 Nov), breakfast and lunch only".
 */
export function scheduleNotes(member: ScheduledMember, today: string): string[] {
  if (!member.work_schedule) return [];
  const notes: string[] = [];
  member.work_schedule.forEach((plan, i) => {
    if (plan.mode === "off") return;
    const parts: string[] = [];
    if (plan.mode === "alternate" && plan.anchor) {
      const next = nextWorkingOn(plan.anchor, today);
      const [, m, d] = next.split("-").map(Number);
      const month = new Date(Date.UTC(2000, m - 1, 1)).toLocaleString("en-IN", { month: "short", timeZone: "UTC" });
      parts.push(`alternate weeks (next ${d} ${month})`);
    }
    if (member.role === "cook" && plan.meals.length && plan.meals.length < MEALS.length) {
      parts.push(`${mealList(MEALS.filter((m) => plan.meals.includes(m)))} only`);
    }
    if (parts.length) notes.push(`${WEEKDAYS_SHORT[i]}: ${parts.join(", ")}`);
  });
  return notes;
}

/** True when the schedule is the same as having none (every day, every meal). */
export const isEveryDay = (schedule: WorkSchedule | null | undefined) =>
  !schedule || schedule.every((p) => p.mode === "every" && MEALS.every((m) => p.meals.includes(m)));
