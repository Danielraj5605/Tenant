import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { loadAvailability } from "@/lib/availability";
import { loadChoreWeek } from "@/lib/chores";
import { myShareThisMonth } from "@/lib/money";
import { formatINR } from "@/lib/engine/money";
import { formatMonth, monthOf } from "@/lib/engine/calendar";
import { createClient } from "@/lib/supabase/server";
import { MEALS, headcount, slotsPhrase, type Meal } from "@/lib/engine/presence";
import { cookStatusOn, weekStart } from "@/lib/engine/menu";
import { DutyButton } from "@/components/chore-duty";
import { InstallCard } from "@/components/install-card";
import { NoCookCard } from "@/components/no-cook";
import { MealList, mealsPhrase } from "@/components/meals";
import { GetStarted } from "@/components/get-started";
import { formatLongDate, greetingFor, hourIn, todayIn } from "@/lib/engine/dates";
import { addDays, formatShortDate } from "@/lib/engine/calendar";
import { awayOn, isPresent, returnDate } from "@/lib/engine/presence";
import { Avatar, Card, Pill, SectionHeading, cx } from "@/components/ui";
import { AlertIcon, CalendarIcon, CheckIcon, ChevronRightIcon, UsersIcon } from "@/components/icons";

export const metadata = { title: "Today · Tenant" };

/** Days ahead to look for cook and maid leave. */
const ALERT_DAYS = 7;

type Alert = { key: string; tone: "warn" | "info"; text: string; date: string; href: string };

export default async function TodayPage() {
  const { me, flat } = await requireFlat();
  const now = new Date();
  const today = todayIn(flat.timezone, now);
  const horizon = addDays(today, ALERT_DAYS - 1);
  const supabase = await createClient();
  const [{ members, periods }, { views }, { data: menuWeek }, myShare, { data: requests }] = await Promise.all([
    loadAvailability(flat.id, today, horizon),
    loadChoreWeek(flat.id, today, 1),
    // Today's meals, and the plan for each day an alert might cover.
    supabase.from("menu_days").select("*").eq("flat_id", flat.id).gte("date", today).lte("date", horizon),
    myShareThisMonth(flat.id, monthOf(today), me.id),
    me.is_admin
      ? supabase.from("join_requests").select("name").eq("flat_id", flat.id).eq("status", "pending").order("created_at")
      : Promise.resolve({ data: [] as { name: string }[] }),
  ]);
  const joinNames = (requests ?? []).map((r) => r.name);
  const menu = (menuWeek ?? []).find((d) => d.date === today) ?? null;
  const planOn = new Map((menuWeek ?? []).map((d) => [d.date, d.plan]));
  const hasDishes = (d: { breakfast: string | null; lunch: string | null; dinner: string | null }) => Boolean(d.breakfast || d.lunch || d.dinner);
  const canPlan = flat.menu_owner_id ? flat.menu_owner_id === me.id : me.is_admin;
  const myDuties = views.filter((v) => v.today?.member_id === me.id);
  const counts = Object.fromEntries(MEALS.map((m) => [m, headcount(members, today, periods, m)])) as Record<Meal, number>;
  const { noCook, noCookMeals } = cookStatusOn(members, today, periods);

  const flatmates = members.filter(
    (m) => m.role === "flatmate" && m.joined_on <= today && (!m.left_on || m.left_on >= today),
  );
  const awayToday = awayOn(today, periods);
  const home = flatmates.filter((m) => isPresent(m, today, periods));
  const away = flatmates
    .filter((m) => !isPresent(m, today, periods))
    .map((m) => {
      const period = awayToday.find((p) => p.member_id === m.id);
      return { member: m, back: period ? returnDate(period) : null, periodId: period?.id ?? null };
    });

  // First-run checklist for the admin; each step ticks itself off from real data.
  const employedToday = (m: { joined_on: string; left_on: string | null }) => m.joined_on <= today && (!m.left_on || m.left_on >= today);
  const setupSteps = me.is_admin
    ? [
        { key: "flatmates", label: "Add your flatmates", hint: "Share the flat code; you accept each request.", href: "/settings#add-flatmate", done: members.filter((m) => m.role === "flatmate" && employedToday(m)).length >= 2 },
        { key: "staff", label: "Add the cook or maid", hint: "Meals and leave alerts follow them.", href: "/settings#add-staff", done: members.some((m) => m.role !== "flatmate" && employedToday(m)) },
        { key: "chores", label: "Add a chore", hint: "Trash, kitchen, water cans: turns rotate by themselves.", href: "/chores/new", done: views.length > 0 },
        { key: "menu", label: "Plan this week's meals", hint: "Everyone sees what's cooking and who's eating.", href: "/menu", done: (menuWeek ?? []).some(hasDishes) },
      ]
    : [];

  // One alert per staff member per day of leave in the next week.
  const alerts: Alert[] = [];
  for (const staff of members.filter((m) => m.role !== "flatmate")) {
    for (let i = 0; i < ALERT_DAYS; i++) {
      const date = addDays(today, i);
      const period = awayOn(date, periods).find((p) => p.member_id === staff.id);
      if (!period || (i === 0 && staff.role === "cook")) continue;
      // Leave of someone who no longer works for the flat doesn't matter.
      if (staff.joined_on > date || (staff.left_on && staff.left_on < date)) continue;
      const when = i === 0 ? "today" : i === 1 ? "tomorrow" : `on ${formatShortDate(date)}`;
      if (staff.role === "cook") {
        const meals = cookStatusOn(members, date, periods).noCookMeals;
        if (meals.length === 0) continue;
        const forMeals = meals.length === MEALS.length ? "" : ` for ${mealsPhrase(meals)}`;
        const plan = planOn.get(date) ?? "cook";
        // The Order in / We'll cook buttons are on that week's menu.
        const menuHref = `/menu?w=${weekStart(date)}`;
        // Once the flat has decided, say what was decided instead of asking again.
        alerts.push(
          plan === "cook"
            ? { key: `${staff.id}-${date}`, tone: "warn", date, href: menuHref, text: `No cook${forMeals} ${when}. Order in or cook yourselves?` }
            : { key: `${staff.id}-${date}`, tone: "info", date, href: menuHref, text: `No cook${forMeals} ${when}: ${plan === "order_in" ? "ordering in" : "you're cooking"}.` },
        );
      } else {
        const part = period.full_day ? "" : ` ${slotsPhrase(period.slots ?? [])}`.trimEnd();
        alerts.push({ key: `${staff.id}-${date}`, tone: "info", date, href: `/calendar?d=${date}`, text: `No maid ${when}${part}. Cleaning is on us.` });
      }
    }
  }

  const pendingDuties = myDuties.filter((d) => d.today && d.today.status !== "done");
  const monthName = formatMonth(monthOf(today)).split(" ")[0];

  return (
    <div data-wide className="flex flex-col gap-4">
      <header className="mb-2 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-semibold text-muted">{formatLongDate(today)}</p>
          <h1 className="text-display font-extrabold text-balance lg:text-display-lg">
            {greetingFor(hourIn(flat.timezone, now))}, {me.name}
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label="Flat settings"
          className="flex size-11 shrink-0 items-center justify-center rounded-full transition-shadow hover:ring-2 hover:ring-line-strong lg:hidden"
        >
          <Avatar name={me.name} size={44} />
        </Link>
      </header>

      <InstallCard />
      <GetStarted steps={setupSteps} />

      {joinNames.length || alerts.length ? (
        <section aria-label="Alerts" className="flex flex-col gap-2">
          {joinNames.length ? (
            <AlertLink href="/settings#requests" tone="info" icon={<UsersIcon size={20} />}>
              {joinNames.length === 1 ? `${joinNames[0]} wants to join the flat.` : `${joinNames.length} people want to join the flat.`}{" "}
              Review
            </AlertLink>
          ) : null}
          {alerts.map((a) => (
            <AlertLink key={a.key} href={a.href} tone={a.tone} icon={<AlertIcon size={20} />}>
              {a.text}
            </AlertLink>
          ))}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          {pendingDuties.length ? (
            // The one thing to act on today gets the strongest block on the page.
            <section aria-labelledby="duty-title" className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-accent p-5 text-white">
              <h2 id="duty-title" className="text-sm font-semibold text-white/90">
                Your duty today
              </h2>
              <ul className="flex flex-col divide-y divide-white/15">
                {myDuties.map(({ chore, today: duty }) =>
                  duty?.status === "done" ? (
                    <li key={chore.id} className="flex min-h-14 items-center gap-3 py-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-accent-dark">
                        <CheckIcon size={16} strokeWidth={2.5} />
                      </span>
                      <span className="flex-1 font-bold">
                        {chore.name}
                        <span className="sr-only">, done</span>
                      </span>
                      <DutyButton assignmentId={duty.id} done tone="inverse" />
                    </li>
                  ) : (
                    <li key={chore.id} className="flex flex-col gap-4 pt-1 pb-4 last:pb-0 [&+li]:pt-4">
                      <p className="text-2xl leading-tight font-extrabold tracking-tight">{chore.name}</p>
                      {duty ? <DutyButton assignmentId={duty.id} done={false} tone="inverse" /> : null}
                    </li>
                  ),
                )}
              </ul>
            </section>
          ) : (
            <Card className="flex flex-col gap-2">
              <SectionHeading
                title="Your duty today"
                meta={
                  <Link
                    href="/chores"
                    className="-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-sm font-bold text-accent hover:bg-accent-tint"
                  >
                    Rotation
                    <ChevronRightIcon size={16} />
                  </Link>
                }
              />
              {myDuties.length === 0 ? (
                <p className="text-muted">Nothing for you today.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {myDuties.map(({ chore, today: duty }) => (
                    <li key={chore.id} className="flex min-h-14 items-center gap-3 py-1.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                        <CheckIcon size={16} strokeWidth={2.5} />
                      </span>
                      <span className="flex-1 font-semibold">
                        {chore.name}
                        <span className="sr-only">, done</span>
                      </span>
                      {duty ? <DutyButton assignmentId={duty.id} done /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card className="flex flex-col gap-4">
            <SectionHeading
              title={<>Who&rsquo;s home</>}
              meta={
                <Pill>
                  {home.length} of {flatmates.length} home
                </Pill>
              }
            />
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3 md:grid-cols-6 lg:grid-cols-4">
              {home.map((m) => (
                <li key={m.id} className="flex min-w-0 flex-col items-center gap-1.5 py-1">
                  <Avatar name={m.name} size={48} />
                  <span className="w-full truncate text-center text-xs font-semibold">{m.name}</span>
                </li>
              ))}
              {away.map(({ member, back, periodId }) => {
                const body = (
                  <>
                    <Avatar name={member.name} size={48} away />
                    <span className="w-full truncate text-center text-xs font-semibold text-muted">{member.name}</span>
                    {back ? (
                      <span className="-mt-1 w-full truncate text-center text-xs text-muted">Back {formatShortDate(back).slice(4)}</span>
                    ) : null}
                  </>
                );
                return (
                  <li key={member.id} className="min-w-0">
                    {periodId ? (
                      // Tap to change the return date (or see it, if it isn't yours to change).
                      <Link
                        href={`/calendar/away/${periodId}`}
                        aria-label={`${member.name}, away${back ? `, back ${formatShortDate(back)}` : ""}`}
                        className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 hover:bg-sunk"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-col items-center gap-1.5 py-1">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <SectionHeading
              title={<>Today&rsquo;s menu</>}
              meta={
                <Link
                  href="/menu"
                  className="-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-sm font-bold text-accent hover:bg-accent-tint"
                >
                  This week
                  <ChevronRightIcon size={16} />
                </Link>
              }
            />
            <MealList day={menu} counts={counts} noCookMeals={noCookMeals} />
            {noCook ? (
              <NoCookCard
                date={today}
                plan={menu?.plan ?? "cook"}
                label={noCookMeals.length === MEALS.length ? "today" : `for ${mealsPhrase(noCookMeals)} today`}
              />
            ) : null}
            {canPlan && !(menu && hasDishes(menu)) ? (
              <Link
                href={`/menu/${today}`}
                className="-mx-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
              >
                Plan today&rsquo;s meals
                <ChevronRightIcon size={16} />
              </Link>
            ) : null}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/money"
              className="group flex min-h-28 flex-col justify-between gap-3 rounded-[var(--radius-card)] bg-surface p-4 transition-shadow hover:ring-2 hover:ring-line-strong"
            >
              <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
                Your share, {monthName}
                <ChevronRightIcon size={16} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-xl font-extrabold tracking-tight tabular-nums min-[400px]:text-2xl">{formatINR(myShare)}</span>
            </Link>
            <Link
              href="/calendar/away/new"
              className="group flex min-h-28 flex-col justify-between gap-3 rounded-[var(--radius-card)] bg-surface p-4 transition-shadow hover:ring-2 hover:ring-line-strong"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-accent-tint text-accent-dark">
                <CalendarIcon size={18} />
              </span>
              <span className="leading-snug font-bold">Mark someone away</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertLink({
  href,
  tone,
  icon,
  children,
}: {
  href: string;
  tone: "warn" | "info";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 font-semibold transition-[filter] hover:brightness-[0.97]",
        tone === "warn" ? "bg-warn-bg text-warn-ink" : "bg-info-bg text-info-ink",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{children}</span>
      <ChevronRightIcon size={18} className="shrink-0 opacity-70" />
    </Link>
  );
}
