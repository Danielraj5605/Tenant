/**
 * Chore rotation (SPEC §4.3, §5.3). Pure functions; also copied into
 * supabase/functions/_shared/engine for the daily job (npm run engine:sync).
 */
import { addDays } from "./calendar";
import { isPresent, type AwayPeriod, type PresenceMember } from "./presence";

export type ChoreFrequency = "daily" | "weekly" | "custom";

export type Chore = {
  id: string;
  frequency: ChoreFrequency;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. Ignored for daily chores. */
  days_of_week: number[];
};

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function isoWeekday(iso: string): number {
  const [y, mo, d] = iso.split("-").map(Number);
  return ((new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7) + 1;
}

export function isDue(chore: Chore, date: string): boolean {
  return chore.frequency === "daily" || chore.days_of_week.includes(isoWeekday(date));
}

export function scheduleLabel(chore: Chore): string {
  if (chore.frequency === "daily") return "Every day";
  const days = [...chore.days_of_week].sort((a, b) => a - b).map((d) => WEEKDAY[d - 1]);
  if (chore.frequency === "weekly" && days.length === 1) return `Every ${days[0]}`;
  return days.join(", ");
}

/**
 * The first present member after `last` in rotation order, or null when
 * nobody in the rotation is present (the day is skipped).
 */
export function nextAssignee(
  rotation: readonly string[],
  last: string | null,
  date: string,
  members: readonly PresenceMember[],
  periods: readonly AwayPeriod[],
): string | null {
  if (rotation.length === 0) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  const lastIndex = last === null ? -1 : rotation.indexOf(last);
  for (let step = 1; step <= rotation.length; step++) {
    const id = rotation[(lastIndex + step) % rotation.length];
    const member = byId.get(id);
    if (member && isPresent(member, date, periods)) return id;
  }
  return null;
}

export type ProjectedDay = { date: string; memberId: string | null };

/** Owners for each due day in [from, from + days), chaining the rotation. */
export function projectAssignments(
  chore: Chore,
  rotation: readonly string[],
  last: string | null,
  from: string,
  days: number,
  members: readonly PresenceMember[],
  periods: readonly AwayPeriod[],
): ProjectedDay[] {
  const out: ProjectedDay[] = [];
  let previous = last;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (!isDue(chore, date)) continue;
    const memberId = nextAssignee(rotation, previous, date, members, periods);
    out.push({ date, memberId });
    if (memberId) previous = memberId;
  }
  return out;
}

export type AssignmentRow = {
  choreId: string;
  date: string;
  memberId: string | null;
  status: "pending" | "skipped";
};

/** Assignment rows the daily job should insert for `date`. */
export function planToday(input: {
  date: string;
  chores: readonly Chore[];
  rotations: Record<string, readonly string[]>;
  lastAssignees: Record<string, string | null>;
  existing: ReadonlySet<string>;
  members: readonly PresenceMember[];
  periods: readonly AwayPeriod[];
}): AssignmentRow[] {
  const rows: AssignmentRow[] = [];
  for (const chore of input.chores) {
    if (input.existing.has(chore.id) || !isDue(chore, input.date)) continue;
    const memberId = nextAssignee(
      input.rotations[chore.id] ?? [],
      input.lastAssignees[chore.id] ?? null,
      input.date,
      input.members,
      input.periods,
    );
    rows.push({ choreId: chore.id, date: input.date, memberId, status: memberId ? "pending" : "skipped" });
  }
  return rows;
}
