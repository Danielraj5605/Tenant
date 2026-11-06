import Link from "next/link";
import { canManageExpense } from "@/lib/engine/permissions";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/engine/dates";
import { paiseToInput } from "@/lib/engine/money";
import { ChevronLeftIcon } from "@/components/icons";
import { SplitForm, type SplitInitial } from "../split-form";

export const metadata = { title: "New split · Tenant" };

export default async function NewSplitPage({ searchParams }: PageProps<"/money/new">) {
  const { me, flat } = await requireFlat();
  const { edit } = await searchParams;
  const supabase = await createClient();
  const [{ data: members }, { data: periods }, { data: categories }] = await Promise.all([
    supabase.from("members").select("id, name, role, joined_on, left_on").eq("flat_id", flat.id).order("sort_order"),
    supabase.from("away_periods").select("member_id, start_date, end_date, full_day").eq("flat_id", flat.id),
    supabase.from("expense_categories").select("id, name, default_rule").eq("flat_id", flat.id).order("created_at"),
  ]);
  if (!categories?.length) {
    return <p className="text-muted">No expense categories yet. Ask the admin to apply the latest database update.</p>;
  }

  let initial: SplitInitial = {
    id: null,
    title: "",
    categoryId: categories.find((c) => c.name === "Groceries")?.id ?? categories[0].id,
    date: todayIn(flat.timezone),
    total: "",
    paidBy: me.id,
    items: [],
    included: null,
    locks: {},
  };

  if (typeof edit === "string") {
    if (!z.uuid().safeParse(edit).success) notFound();
    const [{ data: expense }, { data: items }, { data: shares }] = await Promise.all([
      supabase.from("expenses").select("*").eq("id", edit).eq("flat_id", flat.id).maybeSingle(),
      supabase.from("expense_items").select("*").eq("expense_id", edit).eq("flat_id", flat.id).order("sort_order"),
      supabase.from("expense_shares").select("*").eq("expense_id", edit).eq("flat_id", flat.id),
    ]);
    if (!expense) notFound();
    if (!canManageExpense(me, expense) || expense.settled) redirect(`/money/${edit}`);
    initial = {
      id: expense.id,
      title: expense.title,
      categoryId: expense.category_id,
      date: expense.expense_date,
      total: paiseToInput(expense.total_paise),
      paidBy: expense.paid_by,
      items: (items ?? []).map((i) => ({
        name: i.name,
        amount: paiseToInput(i.amount_paise),
        kind: i.kind,
        included: i.included,
        personal: i.personal_member_id ?? "",
      })),
      included: (shares ?? []).map((s) => s.member_id),
      locks: Object.fromEntries((shares ?? []).filter((s) => s.is_custom).map((s) => [s.member_id, paiseToInput(s.amount_paise)])),
    };
  }

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href={initial.id ? `/money/${initial.id}` : "/money"}
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          {initial.id ? "Back" : "Money"}
        </Link>
        <h1 className="text-display font-extrabold">{initial.id ? "Edit split" : "New split"}</h1>
      </header>
      <SplitForm
        members={members ?? []}
        periods={periods ?? []}
        categories={categories}
        meId={me.id}
        prorate={flat.prorate_monthly}
        initial={initial}
      />
    </>
  );
}
