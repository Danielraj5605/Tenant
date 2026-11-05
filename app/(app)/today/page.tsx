import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { loadAvailability } from "@/lib/availability";
import { formatLongDate, greetingFor, hourIn, todayIn } from "@/lib/engine/dates";
import { addDays, formatShortDate } from "@/lib/engine/calendar";
import { awayOn, isPresent, returnDate } from "@/lib/engine/presence";
import { Avatar, Card } from "@/components/ui";
import { AlertIcon, ChevronRightIcon } from "@/components/icons";

export const metadata = { title: "Today · Tenant" };

/** Days ahead to look for cook and maid leave. */
const ALERT_DAYS = 7;

type Alert = { key: string; tone: "warn" | "info"; text: string; date: string };

export default async function TodayPage() {
  const { me, flat } = await requireFlat();
  const now = new Date();
  const today = todayIn(flat.timezone, now);
  const horizon = addDays(today, ALERT_DAYS - 1);
  const { members, periods } = await loadAvailability(flat.id, today, horizon);

  const flatmates = members.filter(
    (m) => m.role === "flatmate" && m.joined_on <= today && (!m.left_on || m.left_on >= today),
  );
  const awayToday = awayOn(today, periods);
  const home = flatmates.filter((m) => isPresent(m, today, periods));
  const away = flatmates
    .filter((m) => !isPresent(m, today, periods))
    .map((m) => {
      const period = awayToday.find((p) => p.member_id === m.id);
      return { member: m, back: period ? returnDate(period) : null };
    });

  // One alert per staff member per day of leave in the next week.
  const alerts: Alert[] = [];
  for (const staff of members.filter((m) => m.role !== "flatmate")) {
    for (let i = 0; i < ALERT_DAYS; i++) {
      const date = addDays(today, i);
      const period = awayOn(date, periods).find((p) => p.member_id === staff.id);
      if (!period) continue;
      const when = i === 0 ? "today" : i === 1 ? "tomorrow" : `on ${formatShortDate(date)}`;
      const part = period.full_day ? "" : " for part of the day";
      alerts.push(
        staff.role === "cook"
          ? { key: `${staff.id}-${date}`, tone: "warn", date, text: `No cook ${when}${part}. Order in or cook yourselves?` }
          : { key: `${staff.id}-${date}`, tone: "info", date, text: `No maid ${when}${part}. Cleaning is on us.` },
      );
    }
  }

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-muted">{formatLongDate(today)}</p>
          <h1 className="text-display font-extrabold">
            {greetingFor(hourIn(flat.timezone, now))}, {me.name}
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label="Flat settings"
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:ring-2 hover:ring-line-strong"
        >
          <Avatar name={me.name} size={44} />
        </Link>
      </header>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-title font-bold">Who&rsquo;s home</h2>
            <p className="text-sm font-bold text-accent-dark">
              {home.length} of {flatmates.length}
            </p>
          </div>
          <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
            {home.map((m) => (
              <li key={m.id} className="flex min-w-0 flex-col items-center gap-1">
                <Avatar name={m.name} size={48} />
                <span className="w-full truncate text-center text-xs font-semibold">{m.name}</span>
              </li>
            ))}
            {away.map(({ member, back }) => (
              <li key={member.id} className="flex min-w-0 flex-col items-center gap-1">
                <Avatar name={member.name} size={48} away />
                <span className="w-full truncate text-center text-xs font-semibold text-muted">{member.name}</span>
                {back ? (
                  <span className="w-full truncate text-center text-xs text-muted">Back {formatShortDate(back).slice(4)}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {flatmates.length < 2 && me.is_admin ? (
            <Link
              href="/settings"
              className="-mx-2 flex min-h-11 items-center justify-between rounded-xl px-2 font-bold text-accent hover:bg-accent-tint"
            >
              Invite flatmates
              <ChevronRightIcon size={20} />
            </Link>
          ) : null}
        </Card>

        {alerts.length ? (
          <section aria-label="Alerts" className="flex flex-col gap-2">
            {alerts.map((a) => (
              <Link
                key={a.key}
                href={`/calendar?d=${a.date}`}
                className={
                  a.tone === "warn"
                    ? "flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] bg-warn-bg px-4 py-3 font-semibold text-warn-ink"
                    : "flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] bg-info-bg px-4 py-3 font-semibold text-info-ink"
                }
              >
                <AlertIcon size={20} className="shrink-0" />
                <span className="flex-1">{a.text}</span>
                <ChevronRightIcon size={18} className="shrink-0 opacity-70" />
              </Link>
            ))}
          </section>
        ) : null}

        <Link
          href="/calendar/away/new"
          className="flex min-h-[52px] items-center justify-center rounded-full border border-line-strong bg-surface px-6 font-bold hover:border-ink/40"
        >
          Mark someone away
        </Link>
      </div>
    </>
  );
}
