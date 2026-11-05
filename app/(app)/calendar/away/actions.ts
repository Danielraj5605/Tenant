"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { AwayPeriodInput } from "@/lib/engine/inputs";
import { supabaseEnv } from "@/lib/supabase/env";

/** Ask the notify Edge Function to alert the flat. Best-effort: never blocks saving. */
async function notifyLeave(awayPeriodId: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  try {
    await fetch(`${supabaseEnv().url}/functions/v1/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret },
      body: JSON.stringify({ awayPeriodId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Push is best-effort.
  }
}

export type AwayFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"memberId" | "startDate" | "endDate" | "slots" | "reason", string>>;
};

export async function saveAway(_prev: AwayFormState, form: FormData): Promise<AwayFormState> {
  const { flat, me } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  const parsed = AwayPeriodInput.safeParse({
    memberId: form.get("memberId") ?? "",
    startDate: form.get("startDate") ?? "",
    endDate: form.get("endDate") ?? "",
    fullDay: form.get("fullDay") ?? undefined,
    slots: form.getAll("slots").map(String),
    reason: form.get("reason") ?? "",
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        memberId: fe.memberId?.[0],
        startDate: fe.startDate?.[0],
        endDate: fe.endDate?.[0],
        slots: fe.slots?.[0],
        reason: fe.reason?.[0],
      },
    };
  }

  const v = parsed.data;
  const row = {
    member_id: v.memberId,
    start_date: v.startDate,
    end_date: v.endDate,
    full_day: v.fullDay,
    slots: v.slots,
    reason: v.reason,
  };
  const supabase = await createClient();
  if (id.success) {
    const { error } = await supabase.from("away_periods").update(row).eq("id", id.data).eq("flat_id", flat.id);
    if (error) return { error: "This couldn't be saved. Check your connection and try again." };
  } else {
    const { data, error } = await supabase
      .from("away_periods")
      .insert({ ...row, flat_id: flat.id, created_by: me.id })
      .select("id")
      .single();
    if (error || !data) return { error: "This couldn't be saved. Check your connection and try again." };
    // New cook or maid leave: push an alert to the flat (SPEC 4.9). The Edge
    // Function ignores flatmates. A failed alert never blocks saving.
    await notifyLeave(data.id);
  }

  revalidatePath("/", "layout");
  redirect(`/calendar?d=${v.startDate}`);
}

export async function deleteAway(form: FormData) {
  const { flat } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  const back = String(form.get("back") ?? "");
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("away_periods").delete().eq("id", id.data).eq("flat_id", flat.id);
    revalidatePath("/", "layout");
  }
  redirect(/^\d{4}-\d{2}-\d{2}$/.test(back) ? `/calendar?d=${back}` : "/calendar");
}
