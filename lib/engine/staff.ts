/**
 * Cook & maid page: a staff member's month and today's status.
 * Pure functions over plain data; no database access.
 */
import { addDays } from "./calendar";
import { periodSlots, type AwayPeriod, type AwaySlot, type Meal, type PresenceMember } from "./presence";
import { scheduledOn, type ScheduledMember } from "./schedule";

const employedOn = (m: PresenceMember, date: string) => m.joined_on <= date && (m.left_on === null || date <= m.left_on);
const covers = (p: AwayPeriod, date: string) => p.start_date <= date && date <= p.end_date;

export type StaffMonth = {
  /** Scheduled working days in the month up to today (the whole month once it's over). */
  daysSoFar: number;
  /** Of those, days without full-day leave. Part days count as worked, like pay. */
  workedSoFar: number;
  /** Full days off anywhere in the month, including ones still ahead. */
  fullDaysOff: number;
  /** Days with part-day leave in the month. */
  partDaysOff: number;
  /** Full days off still ahead in the month (after today). */
  fullDaysOffAhead: number;
};

/** A staff member's month: days worked so far and leave taken or planned. */
export function staffMonth(member: ScheduledMember, month: string, today: string, periods: readonly AwayPeriod[]): StaffMonth {
  const mine = periods.filter((p) => p.member_id === member.id);
  const out: StaffMonth = { daysSoFar: 0, workedSoFar: 0, fullDaysOff: 0, partDaysOff: 0, fullDaysOffAhead: 0 };
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) {
    // Days off in the weekly schedule aren't working days, so leave on them doesn't count either.
    if (!employedOn(member, d) || !scheduledOn(member, d).works) continue;
    const full = mine.some((p) => p.full_day && covers(p, d));
    const part = !full && mine.some((p) => !p.full_day && covers(p, d));
    if (full) out.fullDaysOff += 1;
    if (part) out.partDaysOff += 1;
    if (d <= today) {
      out.daysSoFar += 1;
      if (!full) out.workedSoFar += 1;
    } else if (full) {
      out.fullDaysOffAhead += 1;
    }
  }
  return out;
}

export type StaffStatus =
  | { kind: "not_employed" }
  /** `meals`: the cook's meals that day when the schedule doesn't cover all three. */
  | { kind: "working"; meals?: readonly Meal[] }
  /** Not a working day in their weekly schedule. */
  | { kind: "day_off" }
  | { kind: "off" }
  | { kind: "part"; slots: readonly AwaySlot[] };

/** Is the cook or maid working on this date? */
export function staffStatusOn(member: ScheduledMember, date: string, periods: readonly AwayPeriod[]): StaffStatus {
  if (!employedOn(member, date)) return { kind: "not_employed" };
  const plan = scheduledOn(member, date);
  if (!plan.works) return { kind: "day_off" };
  const mine = periods.filter((p) => p.member_id === member.id && covers(p, date));
  if (mine.some((p) => p.full_day)) return { kind: "off" };
  if (mine.length) return { kind: "part", slots: [...new Set(mine.flatMap((p) => periodSlots(p)))] };
  return member.role === "cook" && plan.meals.length < 3 ? { kind: "working", meals: plan.meals } : { kind: "working" };
}

/** "tel:" link for a stored phone number (spaces and dashes dropped). */
export const telHref = (phone: string) => `tel:${phone.replace(/[\s-]/g, "")}`;
