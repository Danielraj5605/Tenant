import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/engine/dates";
import { addDays, formatMonth, formatRange, formatShortDate, isMonth, monthOf, shiftMonth } from "@/lib/engine/calendar";
import { staffMonth, staffStatusOn, telHref } from "@/lib/engine/staff";
import { scheduleNotes, weekStrip, weekdayIndex } from "@/lib/engine/schedule";
import { MEAL_LABEL } from "@/lib/engine/presence";
import type { AwaySlot } from "@/lib/engine/presence";
import type { Member } from "@/lib/supabase/types";
import { Avatar, Card, Notice, cx } from "@/components/ui";
import { Badge, ROLE_LABEL, RoleDot, partLabel } from "@/components/away";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, PhoneIcon, PlusIcon } from "@/components/icons";
import { AddStaffForm } from "./forms";

export const metadata = { title: "Cook & maid · Tenant" };

type Leave = {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  full_day: boolean;
  slots: AwaySlot[] | null;
  reason: string | null;
};

export default async function StaffPage({ searchParams }: PageProps<"/staff">) {
  const { flat } = await requireFlat();
  const { m, saved, removed } = await searchParams;
  const today = todayIn(flat.timezone);
  const month = typeof m === "string" && isMonth(m) ? m : monthOf(today);
  const monthStart = `${month}-01`;
  const monthEnd = addDays(`${shiftMonth(month, 1)}-01`, -1);

  const supabase = await createClient();
  const [{ data: staffRows }, { data: leaveRows }] = await Promise.all([
    supabase.from("members").select("*").eq("flat_id", flat.id).neq("role", "flatmate").order("sort_order"),
    supabase
      .from("away_periods")
      .select("id, member_id, start_date, end_date, full_day, slots, reason")
      .eq("flat_id", flat.id)
      // This month, plus today for the status line.
      .lte("start_date", monthEnd > today ? monthEnd : today)
      .gte("end_date", monthStart < today ? monthStart : today)
      .order("start_date"),
  ]);
  const staff = (staffRows ?? []) as Member[];
  const staffIds = new Set(staff.map((s) => s.id));
  const leave = ((leaveRows ?? []) as Leave[]).filter((l) => staffIds.has(l.member_id));

  const employedIn = (s: Member) => s.joined_on <= monthEnd && (!s.left_on || s.left_on >= monthStart);
  const current = staff.filter((s) => !s.left_on || s.left_on >= today);
  // People working here now first, then anyone who left during this month.
  const shown = [...current, ...staff.filter((s) => !current.includes(s) && employedIn(s))];
  const past = staff.filter((s) => !current.includes(s) && !shown.includes(s));
  const isCurrentMonth = month === monthOf(today);
  const monthName = formatMonth(month).split(" ")[0];
  const hasCook = current.some((s) => s.role === "cook");

  return (
    <div data-wide>
      <header className="mb-5 flex flex-col gap-3">
        <Link
          href="/today"
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink lg:hidden"
        >
          <ChevronLeftIcon size={20} />
          Today
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-display font-extrabold lg:text-display-lg">Cook &amp; maid</h1>
          <p className="font-medium text-muted">Their numbers, days worked and leave. Anyone in the flat can update them.</p>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3 empty:hidden">
        {saved === "schedule" ? (
          <Notice tone="success">Schedule saved. Menu, Today and pay now follow it.</Notice>
        ) : saved ? (
          <Notice tone="success">Saved.</Notice>
        ) : null}
        {removed === "left" ? (
          <Notice tone="success">Removed. Their past pay and leave are kept.</Notice>
        ) : removed === "deleted" ? (
          <Notice tone="success">Removed. They had no history, so nothing else changed.</Notice>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-full bg-surface p-1">
            <Link
              href={`/staff?m=${shiftMonth(month, -1)}`}
              aria-label="Previous month"
              className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
            >
              <ChevronLeftIcon size={22} />
            </Link>
            <h2 className="font-bold" aria-live="polite">
              {formatMonth(month)}
            </h2>
            <Link
              href={`/staff?m=${shiftMonth(month, 1)}`}
              aria-label="Next month"
              className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
            >
              <ChevronRightIcon size={22} />
            </Link>
          </div>

          {shown.length === 0 ? (
            <Card className="flex flex-col items-start gap-2">
              <h2 className="text-title font-bold">No cook or maid yet</h2>
              <p className="text-muted">
                Add them below. Meal headcounts, No-cook alerts and their pay by days worked all follow from here.
              </p>
            </Card>
          ) : (
            shown.map((s) => (
              <StaffCard
                key={s.id}
                person={s}
                today={today}
                month={month}
                monthName={monthName}
                isCurrentMonth={isCurrentMonth}
                leave={leave.filter((l) => l.member_id === s.id)}
                monthStart={monthStart}
                monthEnd={monthEnd}
              />
            ))
          )}

          {past.length ? (
            <Card className="flex flex-col gap-1 px-3">
              <h2 className="px-2 text-sm font-bold tracking-wide text-muted uppercase">Worked here before</h2>
              <ul className="flex flex-col">
                {past.map((s) => (
                  <li key={s.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/staff/${s.id}`}
                      className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg"
                      aria-label={`${s.name}, ${ROLE_LABEL[s.role]}, see details`}
                    >
                      <Avatar name={s.name} size={36} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold">{s.name}</span>
                        <span className="text-sm text-muted">
                          {ROLE_LABEL[s.role]}, until {s.left_on ? formatShortDate(s.left_on) : ""}
                        </span>
                      </span>
                      <ChevronRightIcon size={20} className="shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="add-staff" className="scroll-mt-6 text-title font-bold">
                {current.length ? "Add a cook or maid" : "Add the cook or maid"}
              </h2>
              <p className="text-sm text-muted">They don&rsquo;t sign in. Any flatmate can mark their leave.</p>
            </div>
            <AddStaffForm suggestRole={hasCook ? "maid" : "cook"} />
          </Card>
          <Card className="flex flex-col gap-1.5">
            <h2 className="font-bold">How days worked are counted</h2>
            <p className="text-sm text-muted">
              Only days in their weekly schedule count. A full day of leave on one of those is unpaid; out for part of the
              day still counts as worked. The Cook&rsquo;s pay and Maid&rsquo;s pay splits on Money use the same count.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StaffCard({
  person,
  today,
  month,
  monthName,
  isCurrentMonth,
  leave,
  monthStart,
  monthEnd,
}: {
  person: Member;
  today: string;
  month: string;
  monthName: string;
  isCurrentMonth: boolean;
  leave: Leave[];
  monthStart: string;
  monthEnd: string;
}) {
  const summary = staffMonth(person, month, today, leave);
  const status = staffStatusOn(person, today, leave);
  const inMonth = leave.filter((l) => l.start_date <= monthEnd && l.end_date >= monthStart);
  const future = month > monthOf(today);

  const statusBadge =
    status.kind === "working" ? (
      <Badge>{status.meals ? `Today: ${status.meals.map((m) => MEAL_LABEL[m].toLowerCase()).join(", ")}` : "Working today"}</Badge>
    ) : status.kind === "day_off" ? (
      <Badge tone="neutral">Day off today</Badge>
    ) : status.kind === "off" ? (
      <Badge tone="warn">On leave today</Badge>
    ) : status.kind === "part" ? (
      <Badge tone="info">Out today: {partLabel(status.slots).toLowerCase()}</Badge>
    ) : person.joined_on > today ? (
      <Badge tone="neutral">Starts {formatShortDate(person.joined_on)}</Badge>
    ) : (
      <Badge tone="neutral">Left {person.left_on ? formatShortDate(person.left_on) : ""}</Badge>
    );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          <Avatar name={person.name} size={48} away={status.kind === "off"} />
          <RoleDot role={person.role} className="absolute -right-0.5 -bottom-0.5 size-3.5 ring-2 ring-surface" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate text-title font-bold">{person.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-muted">{ROLE_LABEL[person.role]}</span>
            {statusBadge}
          </div>
        </div>
        <Link
          href={`/staff/${person.id}`}
          aria-label={`Edit ${person.name}`}
          className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-ink"
        >
          <PencilIcon size={18} />
        </Link>
      </div>

      {person.left_on && person.left_on < today && !person.phone ? null : person.phone ? (
        <a
          href={telHref(person.phone)}
          className="flex min-h-12 items-center gap-3 rounded-xl bg-accent-tint px-4 font-semibold text-accent-dark transition-colors hover:bg-accent hover:text-white"
        >
          <PhoneIcon size={18} />
          <span className="flex-1 tabular-nums">{person.phone}</span>
          <span className="text-sm font-bold">Call</span>
        </a>
      ) : (
        <Link
          href={`/staff/${person.id}`}
          className="flex min-h-12 items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 text-sm font-semibold text-muted hover:border-ink/40 hover:text-ink"
        >
          <PlusIcon size={18} />
          Add {person.name}&rsquo;s phone number
        </Link>
      )}

      {/* Someone who has left has no schedule to set. */}
      {!person.left_on || person.left_on >= today ? <WeekStrip person={person} today={today} /> : null}

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-sunk p-3">
          <dt className="text-sm font-semibold text-muted">Days worked</dt>
          <dd className="text-2xl font-extrabold tabular-nums">
            {future ? "–" : summary.workedSoFar}
            {future ? null : <span className="text-base font-bold text-muted"> / {summary.daysSoFar}</span>}
          </dd>
          <dd className="text-xs font-semibold text-muted">
            {future ? `${monthName} hasn't started` : isCurrentMonth ? "So far this month" : `In ${monthName}`}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-sunk p-3">
          <dt className="text-sm font-semibold text-muted">Leave</dt>
          <dd className="text-2xl font-extrabold tabular-nums">
            {summary.fullDaysOff}
            <span className="text-base font-bold text-muted"> {summary.fullDaysOff === 1 ? "day" : "days"}</span>
          </dd>
          <dd className="text-xs font-semibold text-muted">
            {[
              summary.partDaysOff ? `+ ${summary.partDaysOff} part ${summary.partDaysOff === 1 ? "day" : "days"}` : null,
              summary.fullDaysOffAhead && !future ? `${summary.fullDaysOffAhead} still ahead` : null,
            ]
              .filter(Boolean)
              .join(", ") || `Full days in ${monthName}`}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-bold tracking-wide text-muted uppercase">Leave in {monthName}</h3>
        {inMonth.length ? (
          <ul className="-mx-2 flex flex-col">
            {inMonth.map((l) => (
              <li key={l.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/calendar/away/${l.id}`}
                  className="flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg"
                  aria-label={`Edit ${person.name}'s leave, ${formatRange(l.start_date, l.end_date)}`}
                >
                  <span
                    className={cx(
                      "size-2 shrink-0 rounded-full",
                      l.full_day ? "bg-warn-ink" : "bg-info-ink",
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{formatRange(l.start_date, l.end_date)}</span>
                    <span className="truncate text-sm text-muted">
                      {[l.full_day ? "Full day" : partLabel(l.slots), l.reason].filter(Boolean).join(", ")}
                    </span>
                  </span>
                  <ChevronRightIcon size={18} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-sm text-muted">No leave in {monthName}.</p>
        )}
        {!person.left_on || person.left_on >= today ? (
          <Link
            href={`/calendar/away/new?member=${person.id}`}
            className="-mx-2 mt-1 inline-flex min-h-11 w-fit items-center gap-1 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
          >
            <PlusIcon size={16} />
            Mark {person.name}&rsquo;s leave
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

const CHIP: Record<"works" | "part" | "alternate" | "off", { className: string; label: string }> = {
  works: { className: "bg-accent text-white", label: "works" },
  part: { className: "bg-accent-tint text-accent-dark ring-1 ring-inset ring-accent", label: "works, some meals" },
  alternate: { className: "border-2 border-dashed border-accent bg-surface text-accent-dark", label: "alternate weeks" },
  off: { className: "bg-sunk text-muted line-through decoration-muted/60", label: "off" },
};

/** Mon–Sun chips showing the weekly schedule, with notes for alternate and short days. */
function WeekStrip({ person, today }: { person: Member; today: string }) {
  const chips = weekStrip(person);
  const notes = scheduleNotes(person, today);
  const todayIdx = weekdayIndex(today);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold tracking-wide text-muted uppercase">Weekly schedule</h3>
        <Link
          href={`/staff/${person.id}#schedule`}
          className="-mr-2 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
        >
          {person.work_schedule ? "Change" : "Set days"}
        </Link>
      </div>
      <ul className="grid grid-cols-7 gap-1.5" aria-label={`${person.name}'s weekly schedule`}>
        {chips.map((c, i) => (
          <li
            key={c.day}
            className={cx(
              "flex h-10 items-center justify-center rounded-lg text-xs font-bold",
              CHIP[c.state].className,
              i === todayIdx && "outline-2 outline-offset-2 outline-ink/30",
            )}
            title={`${c.day}: ${CHIP[c.state].label}`}
          >
            <span aria-hidden="true">{c.short.slice(0, 2)}</span>
            <span className="sr-only">
              {c.day}: {CHIP[c.state].label}
            </span>
          </li>
        ))}
      </ul>
      {notes.length ? (
        <ul className="flex flex-col gap-0.5 text-sm text-muted">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : !person.work_schedule ? (
        <p className="text-sm text-muted">Every day, every meal.</p>
      ) : null}
    </div>
  );
}
