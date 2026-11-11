import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { loadAvailability } from "@/lib/availability";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, todayIn } from "@/lib/engine/dates";
import { addDays, formatRange, formatShortDate } from "@/lib/engine/calendar";
import { MEALS, headcount, type Meal } from "@/lib/engine/presence";
import { cookStatusOn, weekDates, weekStart } from "@/lib/engine/menu";
import { Card, Notice, Pill, cx } from "@/components/ui";
import { NoCookCard } from "@/components/no-cook";
import { MealList, mealsPhrase } from "@/components/meals";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, UsersIcon } from "@/components/icons";

export const metadata = { title: "Menu · Tenant" };

export default async function MenuPage({ searchParams }: PageProps<"/menu">) {
  const { me, flat } = await requireFlat();
  const { w, saved, denied } = await searchParams;
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

  // On the current week, start at today: earlier days are folded away.
  const earlier = dates.filter((d) => d < today && monday <= today && today <= sunday);
  const upcoming = dates.filter((d) => !earlier.includes(d));
  const planned = dates.filter((d) => {
    const day = byDate.get(d);
    return Boolean(day?.breakfast || day?.lunch || day?.dinner);
  }).length;

  const dayCard = (date: string) => {
    const day = byDate.get(date);
    const home = headcount(members, date, periods);
    const counts = Object.fromEntries(MEALS.map((m) => [m, headcount(members, date, periods, m)])) as Record<Meal, number>;
    const { noCook, noCookMeals } = cookStatusOn(members, date, periods);
    const isToday = date === today;
    const label = isToday ? "today" : `on ${formatShortDate(date)}`;
    const past = date < today;
    const hasDishes = Boolean(day?.breakfast || day?.lunch || day?.dinner);
    return (
      <li key={date} className="min-w-0">
        <Card className={cx("flex flex-col gap-2", isToday && "ring-2 ring-accent", past && "opacity-75")}>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h3 className="flex min-w-0 items-center gap-2 font-bold">
              {isToday ? (
                <>
                  Today<span className="font-medium text-muted">{formatShortDate(date)}</span>
                </>
              ) : (
                formatShortDate(date)
              )}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              <Pill>
                <UsersIcon size={14} />
                {home} home
              </Pill>
              {canPlan && !past ? (
                <Link
                  href={`/menu/${date}`}
                  aria-label={`${hasDishes ? "Edit" : "Plan"} meals for ${formatShortDate(date)}`}
                  className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
                >
                  {hasDishes ? <PencilIcon size={15} /> : <PlusIcon size={16} />}
                  {hasDishes ? "Edit" : "Plan"}
                </Link>
              ) : null}
            </div>
          </div>
          <MealList day={day} counts={counts} noCookMeals={noCookMeals} />
          {!noCook && day && day.plan !== "cook" ? (
            // Decided earlier (e.g. while the cook was on leave): still show it.
            <p className="w-fit rounded-full bg-info-bg px-3 py-1 text-sm font-bold text-info-ink">
              {day.plan === "order_in" ? "Ordering in" : "We’re cooking"}
            </p>
          ) : null}
          {noCook ? (
            <NoCookCard
              date={date}
              plan={day?.plan ?? "cook"}
              label={noCookMeals.length === MEALS.length ? label : `for ${mealsPhrase(noCookMeals)} ${label}`}
            />
          ) : null}
        </Card>
      </li>
    );
  };

  return (
    <div data-wide>
      <header className="mb-5 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-display font-extrabold lg:text-display-lg">Menu</h1>
          {canPlan && sunday >= today ? (
            <Link
              href={`/menu/week?w=${monday}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 font-bold text-white hover:bg-accent-dark"
            >
              <PencilIcon size={17} />
              Plan the week
            </Link>
          ) : null}
        </div>
        <p className="font-medium text-muted">
          {owner
            ? `Planned by ${owner.id === me.id ? "you" : owner.name}`
            : me.is_admin
              ? "You plan meals until you pick a menu owner in Settings."
              : "No menu owner yet. The admin can pick one in Settings."}
        </p>
      </header>

      {denied ? (
        <div className="mb-4">
          <Notice tone="info">
            {owner
              ? `Only ${owner.name}, the menu owner, can plan meals. You can still choose Order in or We’ll cook on a No-cook day.`
              : "Only the flat admin can plan meals until they pick a menu owner in Settings. You can still choose Order in or We’ll cook on a No-cook day."}
          </Notice>
        </div>
      ) : null}
      {saved === "week" ? (
        <div className="mb-4">
          <Notice tone="success">Week saved. Everyone sees the new menu now.</Notice>
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between rounded-full bg-surface p-1 lg:max-w-md">
        <Link
          href={`/menu?w=${addDays(monday, -7)}`}
          aria-label="Previous week"
          className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
        >
          <ChevronLeftIcon size={22} />
        </Link>
        <div className="flex flex-col items-center leading-tight">
          <h2 className="font-bold" aria-live="polite">
            {formatRange(monday, sunday)}
          </h2>
          <span className="text-xs font-semibold text-muted">
            {planned} of 7 days planned
          </span>
        </div>
        <Link
          href={`/menu?w=${addDays(monday, 7)}`}
          aria-label="Next week"
          className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
        >
          <ChevronRightIcon size={22} />
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        {earlier.length ? (
          <li className="lg:col-span-2">
            <details className="group rounded-[var(--radius-card)] bg-surface/60">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-[var(--radius-card)] px-5 font-semibold text-muted hover:text-ink">
                Earlier this week ({earlier.length} {earlier.length === 1 ? "day" : "days"})
                <ChevronRightIcon size={20} className="transition-transform group-open:rotate-90" />
              </summary>
              <ul className="grid gap-3 pt-1 lg:grid-cols-2 lg:items-start">{earlier.map(dayCard)}</ul>
            </details>
          </li>
        ) : null}
        {upcoming.map(dayCard)}
      </ul>
    </div>
  );
}
