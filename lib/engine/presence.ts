/**
 * Presence: the question every feature asks (SPEC §3, §5.1).
 * Pure functions over plain data; no database access.
 */
import { addDays, daysInclusive } from "./calendar";

export type MemberRole = "flatmate" | "cook" | "maid";

export type PresenceMember = {
  id: string;
  role: MemberRole;
  joined_on: string;
  left_on: string | null;
};

export type AwayPeriod = {
  member_id: string;
  start_date: string;
  end_date: string;
  full_day: boolean;
};

/** Absences this long or longer get the "Long away" badge. */
export const LONG_AWAY_DAYS = 30;

const covers = (p: AwayPeriod, date: string) => p.start_date <= date && date <= p.end_date;

const employed = (m: PresenceMember, date: string) =>
  m.joined_on <= date && (m.left_on === null || date <= m.left_on);

/** isPresent = within [joined_on, left_on] and no away period covers the date. */
export function isPresent(member: PresenceMember, date: string, periods: readonly AwayPeriod[]): boolean {
  return employed(member, date) && !periods.some((p) => p.member_id === member.id && covers(p, date));
}

/** Cook pay: a day is worked unless a full-day away period covers it. */
export function cookWorkedOn(member: PresenceMember, date: string, periods: readonly AwayPeriod[]): boolean {
  return employed(member, date) && !periods.some((p) => p.member_id === member.id && p.full_day && covers(p, date));
}

/** Number of present flatmates on a date (SPEC §5.2). */
export function headcount(members: readonly PresenceMember[], date: string, periods: readonly AwayPeriod[]): number {
  return members.filter((m) => m.role === "flatmate" && isPresent(m, date, periods)).length;
}

/** Away periods that cover a date. */
export function awayOn<P extends AwayPeriod>(date: string, periods: readonly P[]): P[] {
  return periods.filter((p) => covers(p, date));
}

/** The day the member is back. */
export const returnDate = (p: AwayPeriod) => addDays(p.end_date, 1);

export const isLongAway = (p: AwayPeriod) => daysInclusive(p.start_date, p.end_date) >= LONG_AWAY_DAYS;
