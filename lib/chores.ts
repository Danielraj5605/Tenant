import "server-only";

import { createClient } from "@/lib/supabase/server";
import { loadAvailability, type Availability } from "@/lib/availability";
import { addDays } from "@/lib/engine/calendar";
import { planToday, projectAssignments, type ProjectedDay } from "@/lib/engine/rotation";
import { dueDateIn, occurrenceAfter, occurrenceOnOrBefore, type MonthlyChore } from "@/lib/engine/monthly";
import type { Chore, ChoreAssignment } from "@/lib/supabase/types";

export type UpcomingDay = ProjectedDay & {
  /** Fixed by an accepted swap: someone other than the rotation's pick does it. */
  swapped?: boolean;
};

export type ChoreView = {
  chore: Chore;
  rotation: string[];
  today: ChoreAssignment | null;
  /** Owners for the following days: the rotation's projection, with swapped days applied. */
  upcoming: UpcomingDay[];
};

/** A monthly chore with its owner, its turns still to do (oldest first) and the next due date. */
export type MonthlyView = {
  chore: Chore & MonthlyChore;
  ownerId: string | null;
  /** This cycle's turn (done or not) plus any earlier ones not done yet. */
  turns: ChoreAssignment[];
  /** Due date of the next cycle after the current one. */
  nextDue: string;
  /** Turn ids whose person is away (whole day) on the due date. */
  awayOnDue: Set<string>;
  /** The chore's person has left the flat: nobody gets new turns until someone is chosen. */
  ownerLeft: boolean;
  /** Names of people who have left, for turns and owners shown on this card. */
  leftNames: Map<string, string>;
  /** Turn ids still assigned to someone who has left; any flatmate can hand these over. */
  leftTurns: Set<string>;
};

/**
 * Chores with today's assignment and the projected week. Creates today's
 * assignment rows if the daily job hasn't run yet, using the same engine.
 */
export async function loadChoreWeek(
  flatId: string,
  today: string,
  days = 7,
): Promise<{ views: ChoreView[]; monthly: MonthlyView[] } & Availability> {
  const supabase = await createClient();
  const end = addDays(today, days - 1);

  const fetchToday = async () =>
    (await supabase.from("chore_assignments").select("*").eq("flat_id", flatId).eq("due_date", today)).data ?? [];

  // Everything the week view needs, in one parallel round trip.
  const [{ data: chores }, { data: rotationRows }, availability, { data: history }, firstTodays] = await Promise.all([
    supabase.from("chores").select("*").eq("flat_id", flatId).order("created_at"),
    supabase.from("chore_rotation").select("*").eq("flat_id", flatId).order("position"),
    loadAvailability(flatId, today, end),
    supabase
      .from("chore_assignments")
      .select("chore_id, member_id, rotation_member_id, due_date")
      .eq("flat_id", flatId)
      .not("member_id", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: false })
      .limit(500),
    fetchToday(),
  ]);
  // Days ahead already fixed by an accepted swap.
  const { data: ahead } = await supabase
    .from("chore_assignments")
    .select("chore_id, member_id, rotation_member_id, due_date")
    .eq("flat_id", flatId)
    .gt("due_date", today)
    .lte("due_date", end);
  const all = chores ?? [];
  const list = all.filter((c) => c.frequency !== "monthly");
  const monthlyChores = all.filter(
    (c): c is Chore & MonthlyChore => c.frequency === "monthly" && c.every_months !== null && c.day_of_month !== null && c.start_month !== null,
  );

  const rotations: Record<string, string[]> = {};
  for (const r of rotationRows ?? []) (rotations[r.chore_id] ??= []).push(r.member_id);

  const lastAssignees: Record<string, string | null> = {};
  // The rotation counts from whose turn it was, not who swapped in.
  for (const h of history ?? []) if (!(h.chore_id in lastAssignees)) lastAssignees[h.chore_id] = h.rotation_member_id ?? h.member_id;

  let todays = firstTodays;
  const missing = planToday({
    date: today,
    chores: list,
    rotations,
    lastAssignees,
    existing: new Set(todays.map((a) => a.chore_id)),
    members: availability.members,
    periods: availability.periods,
  });
  if (missing.length) {
    await supabase.from("chore_assignments").upsert(
      missing.map((r) => ({
        chore_id: r.choreId,
        flat_id: flatId,
        member_id: r.memberId,
        due_date: r.date,
        status: r.status,
      })),
      { onConflict: "chore_id,due_date", ignoreDuplicates: true },
    );
    todays = await fetchToday();
  }

  const views = list.map((chore) => {
    const todayRow = todays.find((a) => a.chore_id === chore.id) ?? null;
    const rotation = rotations[chore.id] ?? [];
    const last = todayRow?.rotation_member_id ?? todayRow?.member_id ?? lastAssignees[chore.id] ?? null;
    const projected = projectAssignments(chore, rotation, last, addDays(today, 1), days - 1, availability.members, availability.periods);
    const upcoming: UpcomingDay[] = projected.map((d) => {
      const fixed = (ahead ?? []).find((a) => a.chore_id === chore.id && a.due_date === d.date);
      return fixed && fixed.member_id ? { date: d.date, memberId: fixed.member_id, swapped: fixed.member_id !== d.memberId } : d;
    });
    return { chore, rotation, today: todayRow, upcoming };
  });

  const currentFlatmates = new Set(
    availability.members.filter((m) => m.role === "flatmate" && (!m.left_on || m.left_on >= today)).map((m) => m.id),
  );
  const monthly = await loadMonthly(flatId, today, monthlyChores, rotations, currentFlatmates);
  return { views, monthly, ...availability };
}

/**
 * Monthly chores: makes sure this cycle's turn exists (assigned to the owner),
 * then returns it with any earlier turns not done yet.
 */
async function loadMonthly(
  flatId: string,
  today: string,
  chores: (Chore & MonthlyChore)[],
  rotations: Record<string, string[]>,
  currentFlatmates: Set<string>,
): Promise<MonthlyView[]> {
  if (chores.length === 0) return [];
  const supabase = await createClient();
  const month = today.slice(0, 7);
  const current = new Map(
    chores.map((c) => {
      const m = occurrenceOnOrBefore(c, month);
      return [c.id, m ? dueDateIn(c, m) : null] as const;
    }),
  );

  const fetchTurns = async () =>
    (
      await supabase
        .from("chore_assignments")
        .select("*")
        .eq("flat_id", flatId)
        .in(
          "chore_id",
          chores.map((c) => c.id),
        )
        .order("due_date", { ascending: false })
        .limit(200)
    ).data ?? [];

  let turns = await fetchTurns();
  // New turns only go to someone still in the flat.
  const missing = chores.filter((c) => {
    const due = current.get(c.id);
    const owner = rotations[c.id]?.[0];
    return due && owner && currentFlatmates.has(owner) && !turns.some((t) => t.chore_id === c.id && t.due_date === due);
  });
  if (missing.length) {
    await supabase.from("chore_assignments").upsert(
      missing.map((c) => ({
        chore_id: c.id,
        flat_id: flatId,
        member_id: rotations[c.id][0],
        due_date: current.get(c.id)!,
        status: "pending" as const,
      })),
      { onConflict: "chore_id,due_date", ignoreDuplicates: true },
    );
    turns = await fetchTurns();
  }

  // Who is away on the due date of a turn still to do: suggest handing it over.
  const open = turns.filter((t) => t.status === "pending" && t.member_id);
  const awayRows = open.length
    ? ((
        await supabase
          .from("away_periods")
          .select("member_id, start_date, end_date")
          .eq("flat_id", flatId)
          .eq("full_day", true)
          .in("member_id", [...new Set(open.map((t) => t.member_id!))])
          .lte("start_date", open.reduce((a, t) => (t.due_date > a ? t.due_date : a), open[0].due_date))
          .gte("end_date", open.reduce((a, t) => (t.due_date < a ? t.due_date : a), open[0].due_date))
      ).data ?? [])
    : [];
  const awayOnDue = new Set(
    open
      .filter((t) => awayRows.some((p) => p.member_id === t.member_id && p.start_date <= t.due_date && t.due_date <= p.end_date))
      .map((t) => t.id),
  );

  // Names of people who have left but still own a job or a turn (current names come from the page).
  const goneIds = [
    ...new Set([
      ...chores.map((c) => rotations[c.id]?.[0]).filter((id): id is string => Boolean(id) && !currentFlatmates.has(id!)),
      ...open.map((t) => t.member_id!).filter((id) => !currentFlatmates.has(id)),
    ]),
  ];
  const leftNames = new Map(
    goneIds.length
      ? ((await supabase.from("members").select("id, name").in("id", goneIds)).data ?? []).map((m) => [m.id, m.name] as const)
      : [],
  );

  return chores.map((chore) => {
    const due = current.get(chore.id) ?? null;
    const mine = turns.filter((t) => t.chore_id === chore.id);
    const shown = mine
      .filter((t) => t.due_date === due || (t.status === "pending" && (due === null || t.due_date < due)))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    return {
      chore,
      ownerId: rotations[chore.id]?.[0] ?? null,
      turns: shown,
      nextDue: dueDateIn(chore, occurrenceAfter(chore, month)),
      awayOnDue,
      ownerLeft: Boolean(rotations[chore.id]?.[0]) && !currentFlatmates.has(rotations[chore.id][0]),
      leftNames,
      leftTurns: new Set(shown.filter((t) => t.status === "pending" && t.member_id && !currentFlatmates.has(t.member_id)).map((t) => t.id)),
    };
  });
}
