import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/engine/calendar";
import { formatINR, splitTotal } from "@/lib/engine/money";
import { Avatar, Card, cx } from "@/components/ui";
import { Badge } from "@/components/away";
import { ChevronLeftIcon } from "@/components/icons";
import { ExpenseActions } from "./expense-actions";

export const metadata = { title: "Expense · Tenant" };

const EXTRA_LABEL = { fee: "Fee", tax: "Tax", discount: "Discount" } as const;

export default async function ExpensePage({ params }: PageProps<"/money/[id]">) {
  const { me, flat } = await requireFlat();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: e }, { data: items }, { data: shares }, { data: members }] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).eq("flat_id", flat.id).maybeSingle(),
    supabase.from("expense_items").select("*").eq("expense_id", id).order("sort_order"),
    supabase.from("expense_shares").select("*").eq("expense_id", id).order("amount_paise", { ascending: false }),
    supabase.from("members").select("id, name").eq("flat_id", flat.id),
  ]);
  if (!e) notFound();
  const { data: category } = await supabase.from("expense_categories").select("name").eq("id", e.category_id).maybeSingle();

  const nameOf = new Map((members ?? []).map((m) => [m.id, m.name]));
  const who = (mid: string) => (mid === me.id ? "You" : (nameOf.get(mid) ?? "Former member"));
  const payer = e.paid_by === me.id ? "you" : (nameOf.get(e.paid_by) ?? "the payer");
  const list = items ?? [];
  const billItems = list.filter((i) => i.included && i.kind === "item");
  const extras = list.filter((i) => i.included && i.kind !== "item");
  const notSplitItems = list.filter((i) => !i.included);
  const { split, notSplit } = splitTotal(
    list.map((i) => ({
      name: i.name,
      amountPaise: i.amount_paise,
      kind: i.kind,
      included: i.included,
      personalMemberId: i.personal_member_id,
    })),
    e.total_paise,
  );
  const isCreator = e.created_by === me.id;
  const billUrl = e.bill_image_path
    ? (await supabase.storage.from("bills").createSignedUrl(e.bill_image_path, 60 * 60)).data?.signedUrl
    : null;

  const line = (key: string, label: React.ReactNode, amount: number, opts: { negative?: boolean; muted?: boolean } = {}) => (
    <div key={key} className={cx("flex min-h-10 items-baseline justify-between gap-3", opts.muted && "text-muted")}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{formatINR(opts.negative ? -amount : amount)}</span>
    </div>
  );

  return (
    <>
      <header className="mb-5 flex flex-col gap-3">
        <Link
          href={`/money?m=${e.expense_date.slice(0, 7)}`}
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          Money
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-display font-extrabold break-words">{e.title}</h1>
          <p className="font-medium text-muted">
            {formatShortDate(e.expense_date)}, paid by {payer}
            {category ? `, ${category.name}` : ""}
          </p>
          <div className="flex gap-2 pt-1">
            <Badge tone={e.source === "scan" ? "info" : "neutral"}>
              {e.source === "scan" ? "Scanned bill" : "Added by hand"}
            </Badge>
            {e.settled ? <Badge tone="neutral">Settled</Badge> : null}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {billUrl ? (
          <a href={billUrl} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
            <img src={billUrl} alt={`Photo of the ${e.title} bill`} className="max-h-64 w-full rounded-[var(--radius-card)] bg-surface object-contain" />
          </a>
        ) : null}
        {list.length ? (
          <Card className="flex flex-col">
            <h2 className="mb-1 text-title font-bold">Bill items</h2>
            {billItems.map((i) =>
              line(
                i.id,
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {i.name}
                  {i.personal_member_id ? (
                    <span className="text-sm text-muted">for {who(i.personal_member_id)}</span>
                  ) : null}
                </span>,
                i.amount_paise,
              ),
            )}
            {extras.length ? (
              <>
                <h3 className="mt-3 mb-1 text-sm font-bold text-muted">Extras</h3>
                {extras.map((i) =>
                  line(
                    i.id,
                    <span>
                      {i.name}{" "}
                      <span className="text-sm text-muted">{EXTRA_LABEL[i.kind as keyof typeof EXTRA_LABEL]}</span>
                    </span>,
                    i.amount_paise,
                    { negative: i.kind === "discount" },
                  ),
                )}
              </>
            ) : null}
            {notSplitItems.length ? (
              <>
                <h3 className="mt-3 mb-1 text-sm font-bold text-muted">Not split, stays with {payer}</h3>
                {notSplitItems.map((i) =>
                  line(i.id, i.name, i.amount_paise, { negative: i.kind === "discount", muted: true }),
                )}
              </>
            ) : null}
            <div className="mt-2 border-t border-line pt-2">
              {line("total", <span className="font-bold">Total</span>, e.total_paise)}
              {notSplit !== 0 ? line("split", "Split", split, { muted: true }) : null}
            </div>
          </Card>
        ) : (
          <Card className="flex items-baseline justify-between">
            <span className="text-title font-bold">Total</span>
            <span className="text-2xl font-extrabold">{formatINR(e.total_paise)}</span>
          </Card>
        )}

        <Card className="flex flex-col gap-2">
          <h2 className="text-title font-bold">How it was split</h2>
          {e.rule_note ? <p className="rounded-xl bg-bg px-3 py-2 text-sm font-semibold">{e.rule_note}</p> : null}
          <ul className="flex flex-col">
            {(shares ?? []).map((s) => (
              <li
                key={s.member_id}
                className={cx(
                  "flex min-h-14 items-center gap-3 border-b border-line py-2 last:border-b-0",
                  s.member_id === me.id && "-mx-2 rounded-xl bg-accent-tint/60 px-2",
                )}
              >
                <Avatar name={nameOf.get(s.member_id) ?? "?"} size={36} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">{who(s.member_id)}</span>
                  {s.reason ? <span className="text-sm text-muted">{s.reason}</span> : null}
                </span>
                <span className="font-bold tabular-nums">{formatINR(s.amount_paise)}</span>
              </li>
            ))}
          </ul>
        </Card>

        {isCreator && !e.settled ? <ExpenseActions id={e.id} /> : null}
        {!isCreator && !e.settled ? (
          <p className="text-sm text-muted">Only {who(e.created_by)} can edit this split.</p>
        ) : null}
      </div>
    </>
  );
}
