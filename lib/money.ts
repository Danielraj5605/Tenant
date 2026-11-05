import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/engine/calendar";
import { shiftMonth } from "@/lib/engine/calendar";
import type { Expense, ExpenseShare } from "@/lib/supabase/types";

export type LedgerRow = Expense & { shareCount: number; myShare: number | null };

/** Expenses dated in `month` (yyyy-mm), newest first, with share counts and my share. */
export async function loadLedger(flatId: string, month: string, meId: string) {
  const supabase = await createClient();
  const start = `${month}-01`;
  const end = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("flat_id", flatId)
    .gte("expense_date", start)
    .lte("expense_date", end)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = (expenses ?? []).map((e) => e.id);
  let shares: Pick<ExpenseShare, "expense_id" | "member_id" | "amount_paise">[] = [];
  if (ids.length) {
    const { data } = await supabase.from("expense_shares").select("expense_id, member_id, amount_paise").eq("flat_id", flatId).in("expense_id", ids);
    shares = data ?? [];
  }

  const rows: LedgerRow[] = (expenses ?? []).map((e) => {
    const mine = shares.filter((s) => s.expense_id === e.id);
    return {
      ...e,
      shareCount: mine.length,
      myShare: mine.find((s) => s.member_id === meId)?.amount_paise ?? null,
    };
  });

  return {
    rows,
    totalSpend: rows.reduce((s, r) => s + r.total_paise, 0),
    myTotal: rows.reduce((s, r) => s + (r.myShare ?? 0), 0),
  };
}

/** Sum of my shares for expenses dated this month (Today money card). */
export async function myShareThisMonth(flatId: string, month: string, meId: string): Promise<number> {
  const { myTotal } = await loadLedger(flatId, month, meId);
  return myTotal;
}
