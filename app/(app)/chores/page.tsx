import Link from "next/link";
import { canMarkDuty } from "@/lib/engine/permissions";
import { requireFlat } from "@/lib/flat";
import { loadChoreWeek } from "@/lib/chores";
import { todayIn } from "@/lib/engine/dates";
import { addDays, formatRange, formatShortDate } from "@/lib/engine/calendar";
import { isPresent } from "@/lib/engine/presence";
import { scheduleLabel } from "@/lib/engine/rotation";
import { Avatar, Card, Notice, Pill, cx } from "@/components/ui";
import { Badge } from "@/components/away";
import { DutyButton } from "@/components/chore-duty";
import { AlertIcon, CheckIcon, ChevronRightIcon, PencilIcon, PlusIcon } from "@/components/icons";
import { monthlyLabel } from "@/lib/engine/monthly";
import { MonthlyCard } from "./monthly-card";
import { MenuChoreCard } from "./menu-card";
import { createClient } from "@/lib/supabase/server";
import { weekDates, weekStart } from "@/lib/engine/menu";

export const metadata = { title: "Chores · Tenant" };

const formatTime = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, h, m)))
    .toLowerCase();
};

/** "Tue" from an ISO date. */
const weekdayOf = (iso: string) => formatShortDate(iso).split(" ")[0];

export default async function ChoresPage({ searchParams }: PageProps<"/chores">) {
  const { me, flat } = await requireFlat();
  const { tab, saved, handed, always, menu } = await searchParams;
  const view = tab === "rotation" ? "rotation" : "week";
  const today = todayIn(flat.timezone);
  const supabase = await createClient();
  const week = weekDates(weekStart(today));
  const [{ views, monthly, members, periods }, { data: menuWeek }, { data: menuOwner }] = await Promise.all([
    loadChoreWeek(flat.id, today),
    supabase.from("menu_days").select("breakfast, lunch, dinner").eq("flat_id", flat.id).gte("date", week[0]).lte("date", week[6]),
    flat.menu_owner_id
      ? supabase.from("members").select("id, name, left_on").eq("id", flat.menu_owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const weekPlanned = (menuWeek ?? []).filter((d) => d.breakfast || d.lunch || d.dinner).length;
  const menuOwnerLeft = Boolean(menuOwner?.left_on && menuOwner.left_on < today);
  const flatmates = members
    .filter((m) => m.role === "flatmate" && (!m.left_on || m.left_on >= today))
    .map((m) => ({ id: m.id, name: m.name }));
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const shortName = (id: string) => (id === me.id ? "You" : (nameOf.get(id) ?? "Former member"));

  // Away banner: anyone in a rotation who is away for whole days this week.
  // Part-day absences only change meals, so their turns don't move.
  const inRotation = new Set(views.flatMap((v) => v.rotation));
  const weekEnd = addDays(today, 6);
  const awayThisWeek = periods.filter(
    (p) => p.full_day && inRotation.has(p.member_id) && p.start_date <= weekEnd && p.end_date >= today,
  );

  const tabClass = (active: boolean) =>
    cx(
      "flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-bold transition-colors",
      active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
    );

  return (
    <div data-wide>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h1 className="text-display font-extrabold lg:text-display-lg">Chores</h1>
        <div className="flex gap-2">
          <Link
            href="/chores/new"
            aria-label="Add chore"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-tint px-3.5 font-bold text-accent-dark hover:bg-accent hover:text-white"
          >
            <PlusIcon size={18} />
            <span className="max-[389px]:sr-only">Add</span>
          </Link>
          {views.length ? (
            <Link
              href="/chores/edit"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 font-bold text-white hover:bg-accent-dark"
            >
              <PencilIcon size={17} />
              Edit chores
            </Link>
          ) : null}
        </div>
      </header>

      {typeof menu === "string" && nameOf.has(menu) ? (
        <div className="mb-4">
          <Notice tone="success">{menu === me.id ? "You plan the menu now." : `${nameOf.get(menu)} plans the menu now. They'll get a notification.`}</Notice>
        </div>
      ) : null}
      {typeof handed === "string" && nameOf.has(handed) ? (
        <div className="mb-4">
          <Notice tone="success">
            Handed over to {handed === me.id ? "you" : nameOf.get(handed)}
            {always ? " from now on." : " for this time. Later turns stay with the usual person."}
          </Notice>
        </div>
      ) : null}
      {saved === "all" ? (
        <div className="mb-4">
          <Notice tone="success">Chores saved. Turns from today follow the new settings.</Notice>
        </div>
      ) : null}

      <nav aria-label="Chore views" className="mb-4 flex gap-1 rounded-full bg-line/70 p-1 lg:max-w-sm">
        <Link href="/chores" className={tabClass(view === "week")} aria-current={view === "week" ? "page" : undefined}>
          This week
        </Link>
        <Link
          href="/chores?tab=rotation"
          className={tabClass(view === "rotation")}
          aria-current={view === "rotation" ? "page" : undefined}
        >
          Rotation
        </Link>
      </nav>

      {awayThisWeek.length ? (
        <div className="mb-4 flex gap-3 rounded-[var(--radius-card)] bg-info-bg px-4 py-3 text-sm font-semibold text-info-ink">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            {awayThisWeek.map((p) => (
              <p key={p.id}>
                {nameOf.get(p.member_id)} is away {formatRange(p.start_date, p.end_date)}. Their turns go to the next
                person.
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {views.length === 0 && monthly.length === 0 ? (
        <Card className="flex flex-col gap-3 lg:max-w-xl">
          <h2 className="text-title font-bold">No chores yet</h2>
          <p className="text-muted">
            Add garbage, kitchen cleaning, water cans or anything else that rotates. Tenant skips whoever is away. Rent,
            salaries and bills can be monthly chores for one person.
          </p>
          <Link
            href="/chores/new"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-accent font-bold text-white hover:bg-accent-dark"
          >
            <PlusIcon size={20} />
            Add the first chore
          </Link>
        </Card>
      ) : view === "week" ? (
        <div className="flex flex-col gap-6">
          <section aria-label="Plan the menu" className="lg:max-w-[calc(50%-0.375rem)]">
            <MenuChoreCard
              me={me}
              ownerId={flat.menu_owner_id}
              ownerName={menuOwner?.name ?? null}
              ownerLeft={menuOwnerLeft}
              flatmates={flatmates}
              weekPlanned={weekPlanned}
            />
          </section>
          {monthly.length ? (
            <section aria-labelledby="monthly" className="flex flex-col gap-3">
              <h2 id="monthly" className="px-1 text-sm font-bold tracking-wide text-muted uppercase">
                Monthly
              </h2>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
                {monthly.map((m) => (
                  <li key={m.chore.id} className="min-w-0">
                    <MonthlyCard view={m} me={me} today={today} nameOf={nameOf} flatmates={flatmates} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {views.length ? (
            <section aria-labelledby={monthly.length ? "weekly" : undefined} className="flex flex-col gap-3">
              {monthly.length ? (
                <h2 id="weekly" className="px-1 text-sm font-bold tracking-wide text-muted uppercase">
                  This week
                </h2>
              ) : null}
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
                {views.map(({ chore, today: duty, upcoming }) => {
                  const ownerId = duty?.member_id ?? null;
                  const mine = ownerId === me.id;
                  const time = formatTime(chore.due_time);
                  const pendingMine = mine && duty?.status === "pending";
                  return (
                    <li key={chore.id} className="min-w-0">
                      <Card className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col">
                            <h2 className="truncate text-title font-bold">{chore.name}</h2>
                            <p className="text-sm text-muted">
                              {scheduleLabel(chore)}
                              {time ? `, by ${time}` : ""}
                            </p>
                          </div>
                          <Link
                            href={`/chores/${chore.id}`}
                            aria-label={`Edit ${chore.name}`}
                            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm font-bold text-accent-dark hover:border-accent hover:bg-accent-tint"
                          >
                            <PencilIcon size={15} />
                            Edit
                          </Link>
                        </div>

                        <div
                          className={cx(
                            "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2",
                            pendingMine ? "bg-surface ring-2 ring-accent ring-inset" : "bg-sunk",
                          )}
                        >
                          {!duty ? (
                            <p className="text-sm font-semibold text-muted">Not due today</p>
                          ) : duty.status === "skipped" ? (
                            <p className="text-sm font-semibold text-muted">Skipped today: everyone in the rotation is away</p>
                          ) : (
                            <>
                              <Avatar name={nameOf.get(ownerId!) ?? "?"} size={36} />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="text-xs font-semibold text-muted">Today</span>
                                <span className="truncate font-bold">{shortName(ownerId!)}</span>
                              </span>
                              {duty.status === "done" ? (
                                <Pill>
                                  <CheckIcon size={14} strokeWidth={2.5} /> Done
                                </Pill>
                              ) : (
                                <Pill tone={pendingMine ? "accent" : "neutral"}>To do</Pill>
                              )}
                            </>
                          )}
                        </div>
                        {duty && duty.status !== "skipped" && canMarkDuty(me, duty) ? (
                          <DutyButton
                            assignmentId={duty.id}
                            done={duty.status === "done"}
                            forName={mine ? undefined : nameOf.get(ownerId!)}
                          />
                        ) : null}

                        {upcoming.length ? (
                          <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-bold">Who&rsquo;s next</h3>
                            <ol className="grid grid-cols-4 gap-2">
                              {upcoming.slice(0, 4).map((d) => (
                                <li
                                  key={d.date}
                                  className={cx(
                                    "flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center",
                                    d.memberId === me.id ? "border-accent bg-surface ring-1 ring-accent" : "border-line",
                                  )}
                                >
                                  <span className="text-xs font-semibold text-muted">
                                    <abbr title={formatShortDate(d.date)} className="no-underline">
                                      {weekdayOf(d.date)}
                                    </abbr>
                                  </span>
                                  {d.memberId ? (
                                    <Avatar name={nameOf.get(d.memberId) ?? "?"} size={28} />
                                  ) : (
                                    <span className="size-7 rounded-full border-2 border-dashed border-line-strong" aria-hidden="true" />
                                  )}
                                  <span
                                    className={cx(
                                      "w-full truncate text-xs",
                                      d.memberId ? "font-bold" : "font-semibold text-muted",
                                    )}
                                  >
                                    {d.memberId ? shortName(d.memberId) : "Skipped"}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          {monthly.map(({ chore, ownerId }) => (
            <li key={chore.id} className="min-w-0">
              <Card className="flex flex-col gap-2 px-3">
                <Link
                  href={`/chores/${chore.id}`}
                  aria-label={`Edit ${chore.name}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 hover:bg-bg"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-title font-bold">{chore.name}</span>
                    <span className="text-sm text-muted">{monthlyLabel(chore)}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-accent">
                    Edit
                    <ChevronRightIcon size={18} />
                  </span>
                </Link>
                <div className="flex min-h-12 items-center gap-3 px-2">
                  <Avatar name={nameOf.get(ownerId ?? "") ?? "?"} size={32} />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {ownerId === me.id ? "You" : ownerId ? (nameOf.get(ownerId) ?? "Former member") : "Nobody yet"}
                  </span>
                  <Badge tone="neutral">Does it every time</Badge>
                </div>
              </Card>
            </li>
          ))}
          {views.map(({ chore, rotation, today: duty }) => (
            <li key={chore.id} className="min-w-0">
              <Card className="flex flex-col gap-2 px-3">
                <Link
                  href={`/chores/${chore.id}`}
                  aria-label={`Edit ${chore.name}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 hover:bg-bg"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-title font-bold">{chore.name}</span>
                    <span className="text-sm text-muted">{scheduleLabel(chore)}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-accent">
                    Edit
                    <ChevronRightIcon size={18} />
                  </span>
                </Link>
                {/* Rotation order is a real sequence, so it is numbered. */}
                <ol className="flex flex-col divide-y divide-line">
                  {rotation.map((id, i) => {
                    const member = members.find((m) => m.id === id);
                    const away = member ? !isPresent(member, today, periods) : true;
                    const current = duty?.member_id === id;
                    return (
                      <li key={id} className="flex min-h-12 items-center gap-3 px-2">
                        <span className="w-5 text-sm font-bold text-muted tabular-nums">{i + 1}</span>
                        <Avatar name={nameOf.get(id) ?? "?"} size={32} away={away} />
                        <span className={cx("min-w-0 flex-1 truncate font-semibold", away && "text-muted")}>
                          {id === me.id ? "You" : (nameOf.get(id) ?? "Former member")}
                        </span>
                        {away ? <Badge tone="info">Away, skipped</Badge> : current ? <Badge>Today</Badge> : null}
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
