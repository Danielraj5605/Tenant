import Link from "next/link";
import { canMarkDuty } from "@/lib/engine/permissions";
import { requireFlat } from "@/lib/flat";
import { loadChoreWeek } from "@/lib/chores";
import { todayIn } from "@/lib/engine/dates";
import { addDays, formatRange, formatShortDate } from "@/lib/engine/calendar";
import { isPresent } from "@/lib/engine/presence";
import { scheduleLabel } from "@/lib/engine/rotation";
import { Avatar, Card, Notice, cx } from "@/components/ui";
import { Badge } from "@/components/away";
import { DutyButton } from "@/components/chore-duty";
import { CheckIcon, ChevronRightIcon, PencilIcon, PlusIcon } from "@/components/icons";

export const metadata = { title: "Chores · Tenant" };

const formatTime = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, 0, 1, h, m)))
    .toLowerCase();
};

export default async function ChoresPage({ searchParams }: PageProps<"/chores">) {
  const { me, flat } = await requireFlat();
  const { tab, saved } = await searchParams;
  const view = tab === "rotation" ? "rotation" : "week";
  const today = todayIn(flat.timezone);
  const { views, members, periods } = await loadChoreWeek(flat.id, today);
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  // Away banner: anyone in a rotation who is away for whole days this week.
  // Part-day absences only change meals, so their turns don't move.
  const inRotation = new Set(views.flatMap((v) => v.rotation));
  const weekEnd = addDays(today, 6);
  const awayThisWeek = periods.filter(
    (p) => p.full_day && inRotation.has(p.member_id) && p.start_date <= weekEnd && p.end_date >= today,
  );

  const tabClass = (active: boolean) =>
    cx(
      "flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-bold",
      active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
    );

  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h1 className="text-display font-extrabold">Chores</h1>
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

      {saved === "all" ? (
        <div className="mb-4">
          <Notice tone="success">Chores saved. Turns from today follow the new settings.</Notice>
        </div>
      ) : null}

      <nav aria-label="Chore views" className="mb-4 flex gap-1 rounded-full bg-line/70 p-1">
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
        <div className="mb-4 rounded-[var(--radius-card)] bg-info-bg px-4 py-3 text-sm font-semibold text-info-ink">
          {awayThisWeek.map((p) => (
            <p key={p.id}>
              {nameOf.get(p.member_id)} is away {formatRange(p.start_date, p.end_date)}. Their turns go to the next
              person.
            </p>
          ))}
        </div>
      ) : null}

      {views.length === 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-title font-bold">No chores yet</h2>
          <p className="text-muted">
            Add garbage, kitchen cleaning, water cans or anything else that rotates. Tenant skips whoever is away.
          </p>
          <Link
            href="/chores/new"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-accent font-bold text-white hover:bg-accent-dark"
          >
            Add the first chore
          </Link>
        </Card>
      ) : view === "week" ? (
        <ul className="flex flex-col gap-3">
          {views.map(({ chore, today: duty, upcoming }) => {
            const ownerId = duty?.member_id ?? null;
            const mine = ownerId === me.id;
            const time = formatTime(chore.due_time);
            return (
              <li key={chore.id}>
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

                  <div className="flex items-center gap-3 rounded-xl bg-bg px-3 py-3">
                    {!duty ? (
                      <p className="text-sm font-semibold text-muted">Not due today</p>
                    ) : duty.status === "skipped" ? (
                      <p className="text-sm font-semibold text-muted">Skipped today: everyone in the rotation is away</p>
                    ) : (
                      <>
                        <Avatar name={nameOf.get(ownerId!) ?? "?"} size={36} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-xs font-semibold text-muted">Today</span>
                          <span className="truncate font-bold">{mine ? "You" : nameOf.get(ownerId!)}</span>
                        </span>
                        {duty.status === "done" ? (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-accent-dark">
                            <CheckIcon size={18} /> Done
                          </span>
                        ) : null}
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
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-bold">Who&rsquo;s next</h3>
                      <ul className="flex flex-col">
                        {upcoming.slice(0, 4).map((d) => (
                          <li key={d.date} className="flex min-h-9 items-center justify-between text-sm">
                            <span className="text-muted">{formatShortDate(d.date)}</span>
                            <span className={d.memberId ? "font-semibold" : "text-muted"}>
                              {d.memberId ? (d.memberId === me.id ? "You" : nameOf.get(d.memberId)) : "Skipped"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {views.map(({ chore, rotation, today: duty }) => (
            <li key={chore.id}>
              <Card className="flex flex-col gap-3 px-3">
                <Link
                  href={`/chores/${chore.id}`}
                  className="flex min-h-11 items-center justify-between rounded-xl px-2 hover:bg-bg"
                >
                  <span className="flex flex-col">
                    <span className="text-title font-bold">{chore.name}</span>
                    <span className="text-sm text-muted">{scheduleLabel(chore)}</span>
                  </span>
                  <ChevronRightIcon size={20} className="text-muted" />
                </Link>
                {/* Rotation order is a real sequence, so it is numbered. */}
                <ol className="flex flex-col">
                  {rotation.map((id, i) => {
                    const member = members.find((m) => m.id === id);
                    const away = member ? !isPresent(member, today, periods) : true;
                    const current = duty?.member_id === id;
                    return (
                      <li key={id} className="flex min-h-12 items-center gap-3 border-t border-line px-2">
                        <span className="w-5 text-sm font-bold text-muted">{i + 1}</span>
                        <Avatar name={nameOf.get(id) ?? "?"} size={32} away={away} />
                        <span className={cx("flex-1 font-semibold", away && "text-muted")}>
                          {nameOf.get(id) ?? "Former member"}
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
    </>
  );
}
