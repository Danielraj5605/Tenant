"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { ExpensePayload } from "@/lib/engine/inputs";
import { monthOf } from "@/lib/engine/calendar";
import { isPresent } from "@/lib/engine/presence";
import { ruleNote, shareReasons, staffPay } from "@/lib/engine/money";

export type SplitFormState = { error?: string };

/** Save a New split (or an edit). Reasons and the rule note are written once, here, and frozen. */
export async function saveSplit(_prev: SplitFormState, form: FormData): Promise<SplitFormState> {
  const { flat, userId } = await requireFlat();
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Something went wrong reading the form. Try again." };
  }
  const parsed = ExpensePayload.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const p = parsed.data;

  const supabase = await createClient();
  const [{ data: category }, { data: members }, { data: periods }] = await Promise.all([
    supabase.from("expense_categories").select("*").eq("id", p.categoryId).eq("flat_id", flat.id).maybeSingle(),
    supabase.from("members").select("*").eq("flat_id", flat.id),
    supabase.from("away_periods").select("*").eq("flat_id", flat.id),
  ]);
  if (!category) return { error: "Pick a category." };
  const all = members ?? [];
  const away = periods ?? [];

  const flatmatesOnDate = all.filter(
    (m) => m.role === "flatmate" && m.joined_on <= p.date && (!m.left_on || p.date <= m.left_on),
  );
  const awayNames = flatmatesOnDate.filter((m) => !isPresent(m, p.date, away)).map((m) => m.name);
  // Pay by days worked: the cook's or maid's (from the category), counting everyone
  // in that role employed that month (e.g. one cook replaced another mid-month).
  const staffRole = category.staff_role ?? "cook";
  const pay = category.default_rule === "per_day_worked" && p.dailyRatePaise ? staffPay(staffRole, p.dailyRatePaise, all, monthOf(p.date), away) : null;
  const payInfo = pay && p.dailyRatePaise ? { ...pay, ratePaise: p.dailyRatePaise, role: staffRole } : undefined;

  const note = ruleNote({
    rule: category.default_rule,
    awayNames,
    edited: p.shares.some((s) => s.isCustom),
    prorated: category.default_rule === "per_day_worked" && flat.prorate_monthly,
    pay: payInfo,
  });

  const items = p.items.map((i) => ({ ...i }));
  const personalTotals: Record<string, number> = {};
  for (const i of items) {
    if (i.included && i.personalMemberId) {
      const signed = i.kind === "discount" ? -i.amountPaise : i.amountPaise;
      personalTotals[i.personalMemberId] = (personalTotals[i.personalMemberId] ?? 0) + signed;
    }
  }
  const reasons = shareReasons({
    items,
    shares: Object.fromEntries(p.shares.map((s) => [s.memberId, s.amountPaise])),
    locked: new Set(p.shares.filter((s) => s.isCustom).map((s) => s.memberId)),
    personalTotals,
  });

  // A scanned bill's photo must be in this flat's folder.
  if (p.billImagePath && !p.billImagePath.startsWith(`${flat.id}/`)) return { error: "That bill photo isn't from this flat." };

  const { data: id, error } = await supabase.rpc("save_expense", {
    p_user_id: userId,
    p: {
      id: p.id,
      category_id: p.categoryId,
      title: p.title,
      merchant: p.merchant,
      paid_by: p.paidBy,
      total_paise: p.totalPaise,
      expense_date: p.date,
      source: p.source,
      bill_image_path: p.billImagePath,
      rule_note: note,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        amount_paise: i.amountPaise,
        kind: i.kind,
        included: i.included,
        personal_member_id: i.personalMemberId,
      })),
      shares: p.shares.map((s) => ({
        member_id: s.memberId,
        amount_paise: s.amountPaise,
        is_custom: s.isCustom,
        reason: reasons[s.memberId] ?? null,
      })),
    },
  });
  if (error || !id) {
    const msg = error?.message ?? "";
    if (msg.includes("read-only")) return { error: "This split is settled and can't be changed." };
    if (msg.includes("Only the person")) return { error: "Only the person who created this split or the flat admin can change it." };
    if (msg.includes("add up")) return { error: "Shares must add up exactly to the total." };
    return { error: "The split couldn't be saved. Try again." };
  }

  revalidatePath("/", "layout");
  redirect(`/money/${id}`);
}

export async function settleExpense(form: FormData) {
  const { userId } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("set_expense_settled", { p_user_id: userId, p_expense_id: id.data });
  revalidatePath("/", "layout");
}

export async function deleteExpense(form: FormData) {
  const { userId } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.rpc("delete_expense", { p_user_id: userId, p_expense_id: id.data });
    revalidatePath("/", "layout");
  }
  redirect("/money");
}

/** Admin: change a category's default split rule (Settings). */
export async function setCategoryRule(form: FormData) {
  const { me, flat } = await requireFlat();
  if (!me.is_admin) return;
  const id = z.uuid().safeParse(form.get("categoryId"));
  const rule = z.enum(["all_members", "present_only", "per_day_worked", "custom"]).safeParse(form.get("rule"));
  if (!id.success || !rule.success) return;
  const supabase = await createClient();
  await supabase.from("expense_categories").update({ default_rule: rule.data }).eq("id", id.data).eq("flat_id", flat.id);
  revalidatePath("/", "layout");
}
