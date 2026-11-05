import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/engine/dates";
import { ChevronLeftIcon } from "@/components/icons";
import { ScanFlow } from "./scan-flow";

export const metadata = { title: "Scan a bill · Tenant" };

export default async function ScanPage() {
  const { me, flat } = await requireFlat();
  const supabase = await createClient();
  const [{ data: members }, { data: periods }, { data: categories }] = await Promise.all([
    supabase.from("members").select("id, name, role, joined_on, left_on").eq("flat_id", flat.id).order("sort_order"),
    supabase.from("away_periods").select("member_id, start_date, end_date, full_day").eq("flat_id", flat.id),
    supabase.from("expense_categories").select("id, name, default_rule").eq("flat_id", flat.id).order("created_at"),
  ]);

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href="/money"
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          Money
        </Link>
        <h1 className="text-display font-extrabold">Scan a bill</h1>
      </header>
      <ScanFlow
        meId={me.id}
        today={todayIn(flat.timezone)}
        members={members ?? []}
        periods={periods ?? []}
        categories={categories ?? []}
        prorate={flat.prorate_monthly}
      />
    </>
  );
}
