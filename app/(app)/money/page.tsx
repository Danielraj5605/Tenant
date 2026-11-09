import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { loadLedger } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/engine/dates";
import { formatMonth, isMonth, monthOf, shiftMonth } from "@/lib/engine/calendar";
import { formatINR } from "@/lib/engine/money";
import { Card, Pill, SectionHeading, cx } from "@/components/ui";
import { Badge } from "@/components/away";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";

export const metadata = { title: "Money · Tenant" };

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function MoneyPage({ searchParams }: PageProps<"/money">) {
  const { me, flat } = await requireFlat();
  const { m } = await searchParams;
  const today = todayIn(flat.timezone);
  const month = typeof m === "string" && isMonth(m) ? m : monthOf(today);
  const supabase = await createClient();
  const [{ rows, totalSpend, myTotal }, { data: members }] = await Promise.all([
    loadLedger(flat.id, month, me.id),
    supabase.from("members").select("id, name").eq("flat_id", flat.id),
  ]);
  const nameOf = new Map((members ?? []).map((x) => [x.id, x.name]));
  const monthName = formatMonth(month).split(" ")[0];
  const isCurrent = month === monthOf(today);

  return (
    <div data-wide>
      <header className="mb-5 flex flex-col gap-1">
        <h1 className="text-display font-extrabold lg:text-display-lg">Money</h1>
        <p className="font-medium text-muted">Shared costs and why each person owes their share.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-8">
          <div className="flex items-center justify-between rounded-full bg-surface p-1">
            <Link
              href={`/money?m=${shiftMonth(month, -1)}`}
              aria-label="Previous month"
              className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
            >
              <ChevronLeftIcon size={22} />
            </Link>
            <h2 className="font-bold" aria-live="polite">
              {formatMonth(month)}
            </h2>
            <Link
              href={`/money?m=${shiftMonth(month, 1)}`}
              aria-label="Next month"
              className="flex size-11 items-center justify-center rounded-full hover:bg-sunk"
            >
              <ChevronRightIcon size={22} />
            </Link>
          </div>

          <Card className="grid grid-cols-2 gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold text-muted">Shared spend</span>
              <span className="truncate text-2xl font-extrabold tabular-nums">{formatINR(totalSpend)}</span>
              <span className="text-xs font-semibold text-muted">
                {rows.length} {rows.length === 1 ? "bill" : "bills"} in {monthName}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1 border-l border-line pl-4">
              <span className="text-sm font-semibold text-muted">Your share</span>
              <span className="truncate text-2xl font-extrabold text-accent-dark tabular-nums">{formatINR(myTotal)}</span>
              <span className="text-xs font-semibold text-muted">{isCurrent ? "So far this month" : `For ${monthName}`}</span>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/money/new"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-accent px-4 font-bold text-white hover:bg-accent-dark"
            >
              <PlusIcon size={20} />
              New split
            </Link>
            <Link
              href="/money/scan"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-bold hover:border-ink/40 hover:bg-bg"
            >
              <CameraIcon size={20} />
              Scan a bill
            </Link>
          </div>
        </div>

        {rows.length === 0 ? (
          <Card className="flex flex-col gap-2">
            <h2 className="text-title font-bold">Nothing in {monthName} yet</h2>
            <p className="text-muted">
              Add rent, WiFi, groceries or the cook&rsquo;s pay with New split, or scan a bill and Tenant reads the items.
            </p>
          </Card>
        ) : (
          <Card className="flex flex-col gap-1 px-3">
            <div className="px-2 pb-1">
              <SectionHeading id="bills-heading" title="Bills" meta={<Pill tone="neutral">{rows.length}</Pill>} />
            </div>
            <ul className="flex flex-col divide-y divide-line" aria-labelledby="bills-heading">
              {rows.map((e) => {
                const day = Number(e.expense_date.slice(8));
                const mon = MONTH_SHORT[Number(e.expense_date.slice(5, 7)) - 1];
                return (
                  <li key={e.id}>
                    <Link href={`/money/${e.id}`} className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-3 hover:bg-bg">
                      <span
                        className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-sunk leading-none"
                        aria-hidden="true"
                      >
                        <span className="text-base font-extrabold tabular-nums">{day}</span>
                        <span className="text-[0.6875rem] font-semibold text-muted">{mon}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-bold">{e.title}</span>
                          {e.settled ? <Badge tone="neutral">Settled</Badge> : null}
                        </span>
                        <span className="truncate text-sm text-muted">
                          <span className="sr-only">{`${day} ${mon}, `}</span>
                          {e.source === "scan" ? <span className="font-semibold text-info-ink">Scanned · </span> : null}
                          Paid by {e.paid_by === me.id ? "you" : nameOf.get(e.paid_by)}, {e.shareCount}{" "}
                          {e.shareCount === 1 ? "person" : "people"}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="font-bold tabular-nums">{formatINR(e.total_paise)}</span>
                        <span
                          className={cx(
                            "text-xs font-semibold tabular-nums",
                            e.myShare ? "text-accent-dark" : "text-muted",
                          )}
                        >
                          {e.myShare ? `You ${formatINR(e.myShare)}` : "Not in it"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
