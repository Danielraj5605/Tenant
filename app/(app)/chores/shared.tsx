import "server-only";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeftIcon } from "@/components/icons";

/** Current flatmates (cook and maid never take chore turns). */
export async function rotationCandidates(flatId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name")
    .eq("flat_id", flatId)
    .eq("role", "flatmate")
    .is("left_on", null)
    .order("sort_order");
  return data ?? [];
}

export function BackToChores() {
  return (
    <Link
      href="/chores"
      className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
    >
      <ChevronLeftIcon size={20} />
      Chores
    </Link>
  );
}
