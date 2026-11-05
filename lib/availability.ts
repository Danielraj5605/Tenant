import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AwayPeriodRow, Member } from "@/lib/supabase/types";

export type Availability = {
  members: Member[];
  periods: AwayPeriodRow[];
};

/**
 * Members whose time in the flat overlaps [start, end], and away periods that
 * overlap the same range. Everything else is computed in lib/engine.
 */
export async function loadAvailability(flatId: string, start: string, end: string): Promise<Availability> {
  const supabase = await createClient();
  const [members, periods] = await Promise.all([
    supabase
      .from("members")
      .select("*")
      .eq("flat_id", flatId)
      .lte("joined_on", end)
      .or(`left_on.is.null,left_on.gte.${start}`)
      .order("sort_order"),
    supabase
      .from("away_periods")
      .select("*")
      .eq("flat_id", flatId)
      .lte("start_date", end)
      .gte("end_date", start)
      .order("start_date"),
  ]);
  if (members.error) throw members.error;
  if (periods.error) throw periods.error;
  return { members: members.data, periods: periods.data };
}
