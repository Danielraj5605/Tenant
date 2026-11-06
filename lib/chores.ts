import "server-only";

import { createClient } from "@/lib/supabase/server";
import { loadAvailability, type Availability } from "@/lib/availability";
import { addDays } from "@/lib/engine/calendar";
import { planToday, projectAssignments, type ProjectedDay } from "@/lib/engine/rotation";
import type { Chore, ChoreAssignment } from "@/lib/supabase/types";

export type ChoreView = {
  chore: Chore;
  rotation: string[];
  today: ChoreAssignment | null;
  /** Projected owners for the following days (not saved). */
  upcoming: ProjectedDay[];
};

/**
 * Chores with today's assignment and the projected week. Creates today's
 * assignment rows if the daily job hasn't run yet, using the same engine.
 */
export async function loadChoreWeek(
  flatId: string,
  today: string,
  days = 7,
): Promise<{ views: ChoreView[] } & Availability> {
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
      .select("chore_id, member_id, due_date")
      .eq("flat_id", flatId)
      .not("member_id", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: false })
      .limit(500),
    fetchToday(),
  ]);
  const list = chores ?? [];

  const rotations: Record<string, string[]> = {};
  for (const r of rotationRows ?? []) (rotations[r.chore_id] ??= []).push(r.member_id);

  const lastAssignees: Record<string, string | null> = {};
  for (const h of history ?? []) if (!(h.chore_id in lastAssignees)) lastAssignees[h.chore_id] = h.member_id;

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
    const last = todayRow?.member_id ?? lastAssignees[chore.id] ?? null;
    return {
      chore,
      rotation,
      today: todayRow,
      upcoming: projectAssignments(
        chore,
        rotation,
        last,
        addDays(today, 1),
        days - 1,
        availability.members,
        availability.periods,
      ),
    };
  });

  return { views, ...availability };
}
