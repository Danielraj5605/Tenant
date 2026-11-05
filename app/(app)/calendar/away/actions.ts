"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { AwayPeriodInput } from "@/lib/engine/inputs";

export type AwayFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"memberId" | "startDate" | "endDate" | "reason", string>>;
};

export async function saveAway(_prev: AwayFormState, form: FormData): Promise<AwayFormState> {
  const { flat } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  const parsed = AwayPeriodInput.safeParse({
    memberId: form.get("memberId") ?? "",
    startDate: form.get("startDate") ?? "",
    endDate: form.get("endDate") ?? "",
    fullDay: form.get("fullDay") ?? undefined,
    reason: form.get("reason") ?? "",
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        memberId: fe.memberId?.[0],
        startDate: fe.startDate?.[0],
        endDate: fe.endDate?.[0],
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
    reason: v.reason,
  };
  const supabase = await createClient();
  const { error } = id.success
    ? await supabase.from("away_periods").update(row).eq("id", id.data).eq("flat_id", flat.id)
    : await supabase.from("away_periods").insert({ ...row, flat_id: flat.id });
  if (error) return { error: "This couldn't be saved. Check your connection and try again." };

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
