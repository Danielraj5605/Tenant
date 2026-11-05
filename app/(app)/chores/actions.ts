"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { ChoreInput } from "@/lib/engine/inputs";

export type ChoreFormState = { error?: string; fieldErrors?: Record<string, string | undefined> };

export async function saveChore(_prev: ChoreFormState, form: FormData): Promise<ChoreFormState> {
  const { flat } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  const parsed = ChoreInput.safeParse({
    name: form.get("name") ?? "",
    frequency: form.get("frequency") ?? "",
    days: form.getAll("days").join(","),
    dueTime: form.get("dueTime") ?? "",
    rotation: form.get("rotation") ?? "[]",
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: { name: fe.name?.[0], days: fe.days?.[0], dueTime: fe.dueTime?.[0], rotation: fe.rotation?.[0] },
    };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const row = { name: v.name, frequency: v.frequency, days_of_week: v.days, due_time: v.dueTime };

  let choreId: string;
  if (id.success) {
    const { error } = await supabase.from("chores").update(row).eq("id", id.data).eq("flat_id", flat.id);
    if (error) return { error: "The chore couldn't be saved. Try again." };
    choreId = id.data;
    await supabase.from("chore_rotation").delete().eq("chore_id", choreId);
  } else {
    const { data, error } = await supabase
      .from("chores")
      .insert({ ...row, flat_id: flat.id })
      .select("id")
      .single();
    if (error || !data) return { error: "The chore couldn't be saved. Try again." };
    choreId = data.id;
  }

  const { error: rotErr } = await supabase
    .from("chore_rotation")
    .insert(v.rotation.map((member_id, position) => ({ chore_id: choreId, member_id, flat_id: flat.id, position })));
  if (rotErr) return { error: "The rotation couldn't be saved. Try again." };

  revalidatePath("/", "layout");
  redirect("/chores");
}

export async function deleteChore(form: FormData) {
  const { flat } = await requireFlat();
  const id = z.uuid().safeParse(form.get("id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("chores").delete().eq("id", id.data).eq("flat_id", flat.id);
    revalidatePath("/", "layout");
  }
  redirect("/chores");
}

/** Mark today's duty done (or undo). Only the owner can; enforced in SQL. */
export async function setChoreDone(form: FormData) {
  await requireFlat();
  const id = z.uuid().safeParse(form.get("assignmentId"));
  const done = form.get("done") === "true";
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("set_chore_done", { p_assignment_id: id.data, p_done: done });
  revalidatePath("/", "layout");
}
