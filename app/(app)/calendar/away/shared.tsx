import "server-only";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";
import type { AwayFormMember } from "./away-form";

/** Current members of the flat, flatmates first, then cook and maid. */
export async function awayFormMembers(flatId: string): Promise<AwayFormMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, role")
    .eq("flat_id", flatId)
    .is("left_on", null)
    .order("sort_order");
  const order = { flatmate: 0, cook: 1, maid: 2 } as const;
  return (data ?? []).sort((a, b) => order[a.role] - order[b.role]);
}

export function BackToCalendar({ date }: { date?: string }) {
  return (
    <Link
      href={date ? `/calendar?d=${date}` : "/calendar"}
      className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
    >
      <ChevronLeftIcon size={20} />
      Calendar
    </Link>
  );
}
