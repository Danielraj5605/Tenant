import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/engine/dates";
import { formatShortDate } from "@/lib/engine/calendar";
import { weekStart } from "@/lib/engine/menu";
import { ChevronLeftIcon } from "@/components/icons";
import { DishesForm } from "./dishes-form";

export const metadata = { title: "Plan meals · Tenant" };

export default async function PlanDayPage({ params }: PageProps<"/menu/[date]">) {
  const { me, flat } = await requireFlat();
  const { date } = await params;
  if (!isIsoDate(date)) notFound();
  const canPlan = flat.menu_owner_id ? flat.menu_owner_id === me.id : me.is_admin;
  // Say why instead of silently bouncing back to the week.
  if (!canPlan) redirect(`/menu?w=${weekStart(date)}&denied=1`);

  const supabase = await createClient();
  const { data: day } = await supabase.from("menu_days").select("*").eq("flat_id", flat.id).eq("date", date).maybeSingle();

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href={`/menu?w=${weekStart(date)}`}
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          Menu
        </Link>
        <h1 className="text-display font-extrabold">{formatShortDate(date)}</h1>
      </header>
      <div className="rounded-[var(--radius-card)] bg-surface p-5 md:p-7">
        <DishesForm date={date} breakfast={day?.breakfast ?? ""} lunch={day?.lunch ?? ""} dinner={day?.dinner ?? ""} />
      </div>
    </>
  );
}
