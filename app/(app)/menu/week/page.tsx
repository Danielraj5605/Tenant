import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, todayIn } from "@/lib/engine/dates";
import { addDays, formatRange } from "@/lib/engine/calendar";
import { weekDates, weekStart } from "@/lib/engine/menu";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { WeekPlanner, type Dishes } from "./week-planner";

export const metadata = { title: "Plan the week · Tenant" };

const toDishes = (d: { breakfast: string | null; lunch: string | null; dinner: string | null } | undefined): Dishes => ({
  breakfast: d?.breakfast ?? "",
  lunch: d?.lunch ?? "",
  dinner: d?.dinner ?? "",
});

const hasAny = (d: Dishes) => Boolean(d.breakfast || d.lunch || d.dinner);

export default async function PlanWeekPage({ searchParams }: PageProps<"/menu/week">) {
  const { me, flat } = await requireFlat();
  const { w } = await searchParams;
  const today = todayIn(flat.timezone);
  const monday = weekStart(typeof w === "string" && isIsoDate(w) ? w : today);
  const canPlan = flat.menu_owner_id ? flat.menu_owner_id === me.id : me.is_admin;
  // Say why instead of silently bouncing back to the week.
  if (!canPlan) redirect(`/menu?w=${monday}&denied=1`);

  const dates = weekDates(monday);
  const lastMonday = addDays(monday, -7);
  const supabase = await createClient();
  const [{ data: days }, { data: template }] = await Promise.all([
    supabase
      .from("menu_days")
      .select("date, breakfast, lunch, dinner")
      .eq("flat_id", flat.id)
      .gte("date", lastMonday)
      .lte("date", dates[6]),
    supabase.from("menu_templates").select("weekday, breakfast, lunch, dinner").eq("flat_id", flat.id),
  ]);
  const byDate = new Map((days ?? []).map((d) => [d.date, d]));
  const byWeekday = new Map((template ?? []).map((t) => [t.weekday, t]));

  const current = dates.map((d) => toDishes(byDate.get(d)));
  const lastWeek = dates.map((d) => toDishes(byDate.get(addDays(d, -7))));
  const usual = dates.map((_, i) => toDishes(byWeekday.get(i + 1)));
  const allPast = dates[6] < today;

  return (
    <div data-wide>
      <header className="mb-5 flex flex-col gap-3">
        <Link
          href={`/menu?w=${monday}`}
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          Menu
        </Link>
        <h1 className="text-display font-extrabold lg:text-display-lg">Plan the week</h1>
      </header>

      <div className="mb-4 flex items-center justify-between rounded-full bg-surface p-1">
        <Link
          href={`/menu/week?w=${lastMonday}`}
          aria-label="Previous week"
          className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
        >
          <ChevronLeftIcon size={22} />
        </Link>
        <h2 className="font-bold">{formatRange(monday, dates[6])}</h2>
        <Link
          href={`/menu/week?w=${addDays(monday, 7)}`}
          aria-label="Next week"
          className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
        >
          <ChevronRightIcon size={22} />
        </Link>
      </div>

      {allPast ? (
        <p className="rounded-xl bg-sunk px-4 py-3 text-sm font-semibold text-muted">
          This week is over, so its meals can&rsquo;t be changed.
        </p>
      ) : null}

      <WeekPlanner
        // Remount when the week changes so the fields start from that week.
        key={monday}
        monday={monday}
        dates={dates}
        today={today}
        initial={current}
        lastWeek={lastWeek.some(hasAny) ? lastWeek : null}
        usual={usual.some(hasAny) ? usual : null}
      />
    </div>
  );
}
