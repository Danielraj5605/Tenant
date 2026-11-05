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
import { awayOn, headcount } from "@/lib/engine/presence";
import type { MemberRole } from "@/lib/supabase/types";
import { AwayRow, DOT_CLASS, RoleDot, type AwayItem } from "@/components/away";
import { ScreenHeader } from "@/components/screen";
import { Card, cx } from "@/components/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export const metadata = { title: "Calendar · Tenant" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ROLE_ORDER: MemberRole[] = ["cook", "maid", "flatmate"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { flat } = await requireFlat();
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

  const selectedAway = awayOn(selected, items);
  const flatmates = members.filter((m) => m.role === "flatmate" && m.joined_on <= selected && (!m.left_on || m.left_on >= selected));
  const home = headcount(members, selected, periods);
  const noCook = selectedAway.some((p) => p.member.role === "cook");

  const href = (q: Record<string, string>) => `/calendar?${new URLSearchParams(q).toString()}`;

  return (
    <>
      <ScreenHeader title="Calendar" />

      <Card className="flex flex-col gap-3 px-3 pt-3 pb-4">
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
                          "mx-auto flex h-12 w-11 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold",
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

        <ul className="flex justify-center gap-4 text-xs font-semibold text-muted" aria-label="Legend">
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

      <section aria-labelledby="day-heading" className="mt-4 flex flex-col gap-2 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="day-heading" className="text-title font-bold">
            {selected === today ? "Today" : formatShortDate(selected)}
          </h2>
          <p className="text-sm font-semibold text-muted">
            {home} of {flatmates.length} home
          </p>
        </div>
        {noCook ? (
          <p className="text-sm font-semibold text-warn-ink">No cook this day.</p>
        ) : null}
        {selectedAway.length === 0 ? (
          <p className="text-muted">Everyone is in.</p>
        ) : (
          <p className="text-muted">
            Away: {selectedAway.map((p) => p.member.name).join(", ")}
          </p>
        )}
      </section>

      <Link
        href={`/calendar/away/new?d=${selected}`}
        className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-dark"
      >
        Mark someone away
      </Link>

      <Card className="mt-5 flex flex-col gap-1 px-3">
        <h2 className="px-2 pb-1 text-title font-bold">Who&rsquo;s away in {formatMonth(month).split(" ")[0]}</h2>
        {inMonth.length === 0 ? (
          <p className="px-2 pb-1 text-muted">Nobody is marked away this month.</p>
        ) : (
          <ul className="flex flex-col">
            {inMonth.map((item) => (
              <AwayRow key={item.id} item={item} today={today} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
