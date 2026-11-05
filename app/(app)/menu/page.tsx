import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { loadAvailability } from "@/lib/availability";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, todayIn } from "@/lib/engine/dates";
import { addDays, formatRange, formatShortDate } from "@/lib/engine/calendar";
import { headcount } from "@/lib/engine/presence";
import { cookStatusOn, weekDates, weekStart } from "@/lib/engine/menu";
import { Card, cx } from "@/components/ui";
import { NoCookCard } from "@/components/no-cook";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "@/components/icons";

export const metadata = { title: "Menu · Tenant" };

export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  const { me, flat } = await requireFlat();
  const { w } = await searchParams;
  const today = todayIn(flat.timezone);
  const monday = weekStart(typeof w === "string" && isIsoDate(w) ? w : today);
  const dates = weekDates(monday);
  const sunday = dates[6];

  const supabase = await createClient();
  const [{ members, periods }, { data: days }] = await Promise.all([
    loadAvailability(flat.id, monday, sunday),
    supabase.from("menu_days").select("*").eq("flat_id", flat.id).gte("date", monday).lte("date", sunday),
  ]);
  const byDate = new Map((days ?? []).map((d) => [d.date, d]));
  const owner = members.find((m) => m.id === flat.menu_owner_id);
  const canPlan = flat.menu_owner_id ? flat.menu_owner_id === me.id : me.is_admin;

  return (
    <>
      <header className="mb-5 flex flex-col gap-1">
        <h1 className="text-display font-extrabold">Menu</h1>
        <p className="font-medium text-muted">
          {owner ? `Planned by ${owner.id === me.id ? "you" : owner.name}` : "No menu owner yet. The admin can pick one in Settings."}
        </p>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/menu?w=${addDays(monday, -7)}`}
          aria-label="Previous week"
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
        >
          <ChevronLeftIcon size={22} />
        </Link>
        <h2 className="font-bold">{formatRange(monday, sunday)}</h2>
        <Link
          href={`/menu?w=${addDays(monday, 7)}`}
          aria-label="Next week"
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
        >
          <ChevronRightIcon size={22} />
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {dates.map((date) => {
          const day = byDate.get(date);
          const count = headcount(members, date, periods);
          const { noCook } = cookStatusOn(members, date, periods);
          const isToday = date === today;
          const past = date < today;
          return (
            <li key={date}>
              <Card className={cx("flex flex-col gap-3", isToday && "ring-2 ring-accent", past && "opacity-70")}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">
                    {isToday ? "Today" : formatShortDate(date)}
                    {isToday ? <span className="font-medium text-muted"> {formatShortDate(date)}</span> : null}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-dark">
                    <UsersIcon size={16} />
                    {count} eating
                  </span>
                </div>
                <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1">
                  <dt className="text-sm font-semibold text-muted">Lunch</dt>
                  <dd className={day?.lunch ? "font-semibold" : "text-muted"}>{day?.lunch ?? "Not planned"}</dd>
                  <dt className="text-sm font-semibold text-muted">Dinner</dt>
                  <dd className={day?.dinner ? "font-semibold" : "text-muted"}>{day?.dinner ?? "Not planned"}</dd>
                </dl>
                {noCook ? (
                  <NoCookCard date={date} plan={day?.plan ?? "cook"} label={isToday ? "today" : `on ${formatShortDate(date)}`} />
                ) : null}
                {canPlan && !past ? (
                  <Link
                    href={`/menu/${date}`}
                    className="-mx-2 inline-flex min-h-11 w-fit items-center rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
                  >
                    {day?.lunch || day?.dinner ? "Edit meals" : "Plan meals"}
                  </Link>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
