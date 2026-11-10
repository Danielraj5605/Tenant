import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { loadAvailability } from "@/lib/availability";
import { todayIn, isIsoDate } from "@/lib/engine/dates";
import {
  addDays,
  formatMonth,
  formatShortDate,
  gridRange,
  isMonth,
  monthGrid,
  monthOf,
  shiftMonth,
} from "@/lib/engine/calendar";
import { MEALS, awayOn, headcount } from "@/lib/engine/presence";
import type { MemberRole } from "@/lib/supabase/types";
import { AwayRow, DOT_CLASS, ROLE_LABEL, RoleDot, partLabel, type AwayItem } from "@/components/away";
import { canEditAwayFor } from "@/lib/engine/permissions";
import { mealsPhrase } from "@/components/meals";
import { cookStatusOn } from "@/lib/engine/menu";
import { ScreenHeader } from "@/components/screen";
import { Avatar, Card, Notice, Pill, SectionHeading, cx } from "@/components/ui";
import { AlertIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, UsersIcon } from "@/components/icons";

export const metadata = { title: "Calendar · Tenant" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ROLE_ORDER: MemberRole[] = ["cook", "maid", "flatmate"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { flat, me } = await requireFlat();
  const sp = await searchParams;
  const today = todayIn(flat.timezone);
  const rawMonth = typeof sp.m === "string" ? sp.m : "";
  const rawDay = typeof sp.d === "string" ? sp.d : "";
  const month = isMonth(rawMonth) ? rawMonth : isIsoDate(rawDay) ? monthOf(rawDay) : monthOf(today);
  const selected = isIsoDate(rawDay) && monthOf(rawDay) === month ? rawDay : monthOf(today) === month ? today : `${month}-01`;

  const range = gridRange(month);
  const { members, periods } = await loadAvailability(flat.id, range.start, range.end);
  const byId = new Map(members.map((m) => [m.id, m]));

  const items: AwayItem[] = periods.flatMap((p) => {
    const m = byId.get(p.member_id);
    return m ? [{ ...p, member: { id: m.id, name: m.name, role: m.role } }] : [];
  });

  const rolesAwayOn = (date: string) => {
    const roles = new Set(awayOn(date, items).map((p) => p.member.role));
    return ROLE_ORDER.filter((r) => roles.has(r));
  };

  const monthStart = `${month}-01`;
  const monthEnd = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const inMonth = items.filter((p) => p.start_date <= monthEnd && p.end_date >= monthStart);
  // The cook and maid are listed apart from the flatmates.
  const flatmatesAway = inMonth.filter((p) => p.member.role === "flatmate");
  const staffLeave = inMonth.filter((p) => p.member.role !== "flatmate");
  const monthName = formatMonth(month).split(" ")[0];

  const selectedAway = awayOn(selected, items);
  const flatmates = members.filter((m) => m.role === "flatmate" && m.joined_on <= selected && (!m.left_on || m.left_on >= selected));
  const home = headcount(members, selected, periods);
  // Whole-day absences first, then people out for part of the day.
  const dayRows = [...selectedAway.filter((p) => p.full_day), ...selectedAway.filter((p) => !p.full_day)];
  const dayFlatmates = dayRows.filter((p) => p.member.role === "flatmate");
  const dayStaff = dayRows.filter((p) => p.member.role !== "flatmate");
  const { noCookMeals } = cookStatusOn(members, selected, periods);

  const href = (q: Record<string, string>) => `/calendar?${new URLSearchParams(q).toString()}`;

  return (
    <div data-wide>
      <ScreenHeader title="Calendar" />
      {sp.saved === "edited" || sp.saved === "added" || sp.saved === "removed" ? (
        <div className="mb-4">
          <Notice tone="success">
            {sp.saved === "removed"
              ? "Removed."
              : (() => {
                  const who = members.find((m) => m.id === sp.who);
                  const whose = !who ? "The" : who.id === me.id ? "Your" : `${who.name}’s`;
                  const what = who && who.role !== "flatmate" ? "leave is" : "away days are";
                  return `Saved. ${whose} ${what} ${sp.saved === "added" ? "on the calendar" : "updated"}.`;
                })()}
          </Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <Card className="flex flex-col gap-3 px-3 pt-3 pb-4 lg:sticky lg:top-8">
          <div className="flex items-center justify-between">
            <Link
              href={href({ m: shiftMonth(month, -1) })}
              className="flex size-11 items-center justify-center rounded-full hover:bg-bg"
              aria-label="Previous month"
            >
              <ChevronLeftIcon size={22} />
            </Link>
            <h2 className="text-title font-bold" aria-live="polite">
              {formatMonth(month)}
            </h2>
            <Link
              href={href({ m: shiftMonth(month, 1) })}
              className="flex size-11 items-center justify-center rounded-full hover:bg-bg"
              aria-label="Next month"
            >
              <ChevronRightIcon size={22} />
            </Link>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-center">
            <thead>
              <tr>
                {WEEKDAYS.map((d) => (
                  <th key={d} scope="col" className="pb-1 text-xs font-semibold text-muted">
                    <abbr title={d} className="no-underline">
                      {d.charAt(0)}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthGrid(month).map((week) => (
                <tr key={week[0].date}>
                  {week.map(({ date, inMonth: within }) => {
                    const roles = rolesAwayOn(date);
                    const isToday = date === today;
                    const isSelected = date === selected;
                    const label = `${formatShortDate(date)}${roles.length ? `, ${roles.join(", ")} away` : ""}`;
                    return (
                      <td key={date} className="p-0">
                        <Link
                          href={href({ m: month, d: date })}
                          scroll={false}
                          aria-label={label}
                          aria-current={isSelected ? "date" : undefined}
                          className={cx(
                            "mx-auto flex h-12 w-full max-w-14 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold transition-colors lg:h-14",
                            isSelected ? "bg-accent text-white" : "hover:bg-bg",
                            !isSelected && isToday && "ring-2 ring-accent ring-inset",
                            !within && !isSelected && "text-muted/60",
                          )}
                        >
                          {Number(date.slice(8))}
                          <span className="flex h-1.5 gap-0.5">
                            {roles.map((r) => (
                              <span
                                key={r}
                                className={cx("size-1.5 rounded-full", DOT_CLASS[r], isSelected && "ring-1 ring-white")}
                              />
                            ))}
                          </span>
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-semibold text-muted" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <RoleDot role="cook" className="size-2" /> Cook away
            </li>
            <li className="flex items-center gap-1.5">
              <RoleDot role="maid" className="size-2" /> Maid away
            </li>
            <li className="flex items-center gap-1.5">
              <RoleDot role="flatmate" className="size-2" /> Flatmate away
            </li>
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <SectionHeading
              id="day-heading"
              title={selected === today ? "Today" : formatShortDate(selected)}
              meta={
                <Pill>
                  <UsersIcon size={14} />
                  {home} of {flatmates.length} home
                </Pill>
              }
            />
            {noCookMeals.length ? (
              <p className="flex items-center gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm font-semibold text-warn-ink">
                <AlertIcon size={18} className="shrink-0" />
                {noCookMeals.length === MEALS.length ? "No cook this day." : `No cook for ${mealsPhrase(noCookMeals)}.`}
              </p>
            ) : null}
            {dayRows.length === 0 ? (
              <p className="flex items-center gap-2 py-1 text-muted">
                <CheckIcon size={18} className="shrink-0 text-accent" />
                Everyone is in.
              </p>
            ) : (
              <>
                {dayFlatmates.length ? (
                  <ul className="-mx-2 flex flex-col" aria-labelledby="day-heading">
                    {dayFlatmates.map((p) => (
                      <DayRow key={p.id} p={p} />
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 py-1 text-muted">
                    <CheckIcon size={18} className="shrink-0 text-accent" />
                    All flatmates are in.
                  </p>
                )}
                {dayStaff.length ? (
                  <div className="flex flex-col gap-1 border-t border-line pt-3">
                    <h3 id="day-staff-heading" className="text-sm font-bold tracking-wide text-muted uppercase">
                      Cook &amp; maid
                    </h3>
                    <ul className="-mx-2 flex flex-col" aria-labelledby="day-staff-heading">
                      {dayStaff.map((p) => (
                        <DayRow key={p.id} p={p} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
            <Link
              href={`/calendar/away/new?d=${selected}`}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-dark"
            >
              <PlusIcon size={20} />
              Mark someone away
            </Link>
          </Card>

          <Card className="flex flex-col gap-1 px-3">
            <div className="px-2 pb-1">
              <SectionHeading
                id="month-away-heading"
                title={<>Flatmates away in {monthName}</>}
                meta={flatmatesAway.length ? <Pill tone="neutral">{flatmatesAway.length}</Pill> : null}
              />
            </div>
            {flatmatesAway.length === 0 ? (
              <p className="px-2 pb-1 text-muted">No flatmate is marked away this month.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line" aria-labelledby="month-away-heading">
                {flatmatesAway.map((item) => (
                  <AwayRow key={item.id} item={item} today={today} editable={canEditAwayFor(me, item.member)} />
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col gap-1 px-3">
            <div className="px-2 pb-1">
              <SectionHeading
                id="month-staff-heading"
                title={<>Cook &amp; maid leave in {monthName}</>}
                meta={
                  <Link
                    href={`/staff?m=${month}`}
                    aria-label="Cook and maid details"
                    className="-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-sm font-bold whitespace-nowrap text-accent hover:bg-accent-tint"
                  >
                    Details
                    <ChevronRightIcon size={16} />
                  </Link>
                }
              />
            </div>
            {staffLeave.length === 0 ? (
              <p className="px-2 pb-1 text-muted">No leave for the cook or maid this month.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line" aria-labelledby="month-staff-heading">
                {staffLeave.map((item) => (
                  <AwayRow key={item.id} item={item} today={today} editable={canEditAwayFor(me, item.member)} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** One person away on the selected day. */
function DayRow({ p }: { p: AwayItem }) {
  return (
    <li>
      <Link href={`/calendar/away/${p.id}`} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-bg">
        <span className="relative">
          <Avatar name={p.member.name} size={36} away />
          <RoleDot role={p.member.role} className="absolute -right-0.5 -bottom-0.5 size-3 ring-2 ring-surface" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-bold">{p.member.name}</span>
          <span className="truncate text-sm text-muted">
            {[
              p.member.role !== "flatmate" ? ROLE_LABEL[p.member.role] : null,
              p.full_day ? "Away all day" : `Out: ${partLabel(p.slots).replace(/ only$/, "").toLowerCase()}`,
              p.reason,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ChevronRightIcon size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
