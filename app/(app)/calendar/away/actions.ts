"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { AwayPeriodInput } from "@/lib/engine/inputs";
import { supabaseEnv } from "@/lib/supabase/env";
import { canEditAwayFor, type Actor } from "@/lib/engine/permissions";

const NOT_YOURS = "You can only change your own away days and the cook's or maid's leave. Ask the admin.";

/** The member, if `me` may change their away days; null otherwise. */
async function editableMember(me: Actor, flatId: string, memberId: string) {
  const supabase = await createClient();
  const { data: person } = await supabase
    .from("members")
    .select("id, role")
    .eq("id", memberId)
    .eq("flat_id", flatId)
    .maybeSingle();
  return person && canEditAwayFor(me, person) ? person : null;
}

const mayEditFor = async (me: Actor, flatId: string, memberId: string) => Boolean(await editableMember(me, flatId, memberId));

/** The member an existing away period belongs to, if it's in this flat. */
async function periodOwner(flatId: string, id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("away_periods").select("member_id").eq("id", id).eq("flat_id", flatId).maybeSingle();
  return data?.member_id ?? null;
}

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
  const person = await editableMember(me, flat.id, v.memberId);
  if (!person) return { error: NOT_YOURS };
  const supabase = await createClient();
  if (id.success) {
    const owner = await periodOwner(flat.id, id.data);
    if (!owner) return { error: "This away period no longer exists." };
    if (!(await mayEditFor(me, flat.id, owner))) return { error: NOT_YOURS };
    const { error } = await supabase.from("away_periods").update(row).eq("id", id.data).eq("flat_id", flat.id);
    if (error) return { error: "This couldn't be saved. Check your connection and try again." };
  } else {
    const { data, error } = await supabase
      .from("away_periods")
      .insert({ ...row, flat_id: flat.id, created_by: me.id })
      .select("id")
      .single();
    if (error || !data) return { error: "This couldn't be saved. Check your connection and try again." };
    // New cook or maid leave: push an alert to the flat (SPEC 4.9), after the
    // response so saving never waits for it. Flatmates' away days send nothing.
    if (person.role !== "flatmate") after(() => notifyLeave(data.id));
  }

  revalidatePath("/", "layout");
  // Opened from the Cook & maid page: go back there, on the leave's month.
  // Say it worked, on the page they land on (the Calendar on the first day, or the Cook & maid page).
  redirect(
    form.get("from") === "staff"
      ? `/staff?m=${v.startDate.slice(0, 7)}&saved=1`
      : `/calendar?d=${v.startDate}&saved=${id.success ? "edited" : "added"}&who=${v.memberId}`,
  );
}

export async function deleteAway(form: FormData) {
  const { flat, me } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  const back = String(form.get("back") ?? "");
  const owner = id.success ? await periodOwner(flat.id, id.data) : null;
  if (id.success && owner && (await mayEditFor(me, flat.id, owner))) {
    const supabase = await createClient();
    await supabase.from("away_periods").delete().eq("id", id.data).eq("flat_id", flat.id);
    revalidatePath("/", "layout");
  }
  redirect(/^\d{4}-\d{2}-\d{2}$/.test(back) ? `/calendar?d=${back}&saved=removed` : "/calendar?saved=removed");
}
