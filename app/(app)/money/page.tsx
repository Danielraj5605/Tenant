import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { loadLedger } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/engine/dates";
import { formatMonth, formatShortDate, isMonth, monthOf, shiftMonth } from "@/lib/engine/calendar";
import { formatINR } from "@/lib/engine/money";
import { Card } from "@/components/ui";
import { Badge } from "@/components/away";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";

export const metadata = { title: "Money · Tenant" };

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

  return (
    <>
      <header className="mb-4 flex flex-col gap-1">
        <h1 className="text-display font-extrabold">Money</h1>
        <p className="font-medium text-muted">Shared costs and why each person owes their share.</p>
      </header>

      <div className="mb-3 flex items-center justify-between">
        <Link
          href={`/money?m=${shiftMonth(month, -1)}`}
          aria-label="Previous month"
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
        >
          <ChevronLeftIcon size={22} />
        </Link>
        <h2 className="font-bold">{formatMonth(month)}</h2>
        <Link
          href={`/money?m=${shiftMonth(month, 1)}`}
          aria-label="Next month"
          className="flex size-11 items-center justify-center rounded-full hover:bg-surface"
        >
          <ChevronRightIcon size={22} />
        </Link>
      </div>

      <Card className="mb-4 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-muted">Shared spend in {monthName}</span>
          <span className="text-2xl font-extrabold">{formatINR(totalSpend)}</span>
        </div>
        <div className="flex flex-col gap-1 border-l border-line pl-4">
          <span className="text-sm font-semibold text-muted">Your share</span>
          <span className="text-2xl font-extrabold text-accent-dark">{formatINR(myTotal)}</span>
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link
          href="/money/new"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-accent px-4 font-bold text-white hover:bg-accent-dark"
        >
          <PlusIcon size={20} />
          New split
        </Link>
        <Link
          href="/money/scan"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 font-bold hover:border-ink/40"
        >
          <CameraIcon size={20} />
          Scan a bill
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-title font-bold">Nothing in {monthName} yet</h2>
          <p className="text-muted">Add rent, WiFi, groceries or the cook&rsquo;s pay with New split.</p>
        </Card>
      ) : (
        <Card className="px-2 py-2">
          <ul className="flex flex-col">
            {rows.map((e) => (
              <li key={e.id} className="border-b border-line last:border-b-0">
                <Link href={`/money/${e.id}`} className="flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 hover:bg-bg">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-bold">{e.title}</span>
                      {e.source === "scan" ? <Badge tone="info">Scanned</Badge> : null}
                      {e.settled ? <Badge tone="neutral">Settled</Badge> : null}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {formatShortDate(e.expense_date)}, paid by {e.paid_by === me.id ? "you" : nameOf.get(e.paid_by)}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="font-bold">{formatINR(e.total_paise)}</span>
                    <span className="text-xs font-semibold text-muted">
                      {e.shareCount} {e.shareCount === 1 ? "person" : "people"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
