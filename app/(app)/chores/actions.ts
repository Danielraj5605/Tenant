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

  // Rotation members must be current flatmates of this flat.
  const { data: valid } = await supabase
    .from("members")
    .select("id")
    .eq("flat_id", flat.id)
    .eq("role", "flatmate")
    .in("id", v.rotation);
  if ((valid ?? []).length !== v.rotation.length) return { error: "Someone in the rotation isn't in this flat." };
  const row = { name: v.name, frequency: v.frequency, days_of_week: v.days, due_time: v.dueTime };

  let choreId: string;
  if (id.success) {
    const { data: updated, error } = await supabase
      .from("chores")
      .update(row)
      .eq("id", id.data)
      .eq("flat_id", flat.id)
      .select("id");
    if (error || !updated?.length) return { error: "The chore couldn't be saved. Try again." };
    choreId = id.data;
    await supabase.from("chore_rotation").delete().eq("chore_id", choreId).eq("flat_id", flat.id);
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
  const { userId } = await requireFlat();
  const id = z.uuid().safeParse(form.get("assignmentId"));
  const done = form.get("done") === "true";
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("set_chore_done", { p_user_id: userId, p_assignment_id: id.data, p_done: done });
  revalidatePath("/", "layout");
}

const ChoreEdit = z.object({
  key: z.string().max(60),
  id: z.uuid().nullable(),
  name: z.string(),
  days: z.array(z.number().int().min(1).max(7)).max(7),
  dueTime: z.string(),
  rotation: z.array(z.uuid()),
  deleted: z.boolean(),
});

export type ChoreFieldErrors = { name?: string; days?: string; dueTime?: string; rotation?: string };
export type AllChoresState = { error?: string; errors?: Record<string, ChoreFieldErrors> };

/** All seven days is "daily", one day is "weekly", anything else is "custom". */
const frequencyFor = (days: number[]) => (days.length === 7 ? "daily" : days.length === 1 ? "weekly" : "custom");

/**
 * Saves every changed chore from the Edit chores screen at once: edits, new
 * chores and deletions. Everything is checked before anything is written.
 * Any flatmate can change chores (same rule as the single-chore form).
 */
export async function saveAllChores(_prev: AllChoresState, form: FormData): Promise<AllChoresState> {
  const { flat } = await requireFlat();
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Something went wrong. Reload the page and try again." };
  }
  const list = z.array(ChoreEdit).max(50).safeParse(raw);
  if (!list.success) return { error: "Something went wrong. Reload the page and try again." };

  const errors: Record<string, ChoreFieldErrors> = {};
  const writes: { id: string | null; row: { name: string; frequency: "daily" | "weekly" | "custom"; days_of_week: number[]; due_time: string | null }; rotation: string[] }[] = [];
  const deletes: string[] = [];
  for (const c of list.data) {
    if (c.deleted) {
      if (c.id) deletes.push(c.id);
      continue;
    }
    const days = [...new Set(c.days)].sort((a, b) => a - b);
    if (days.length === 0) {
      errors[c.key] = { days: "Pick at least one day" };
      continue;
    }
    const frequency = frequencyFor(days);
    const parsed = ChoreInput.safeParse({
      name: c.name,
      frequency,
      days: days.join(","),
      dueTime: c.dueTime,
      rotation: JSON.stringify(c.rotation),
    });
    if (!parsed.success) {
      const fe = z.flattenError(parsed.error).fieldErrors;
      errors[c.key] = { name: fe.name?.[0], days: fe.days?.[0], dueTime: fe.dueTime?.[0], rotation: fe.rotation?.[0] };
      continue;
    }
    const v = parsed.data;
    writes.push({
      id: c.id,
      row: { name: v.name, frequency: v.frequency, days_of_week: v.days, due_time: v.dueTime },
      rotation: v.rotation,
    });
  }
  if (Object.keys(errors).length) return { errors, error: "Fix the highlighted chores, then save again." };

  const supabase = await createClient();
  // Chores being changed or deleted must belong to this flat.
  const ids = [...writes.flatMap((w) => (w.id ? [w.id] : [])), ...deletes];
  if (ids.length) {
    const { data: own } = await supabase.from("chores").select("id").eq("flat_id", flat.id).in("id", ids);
    if ((own ?? []).length !== new Set(ids).size) return { error: "Some of these chores are no longer in this flat. Reload and try again." };
  }
  // Rotation members must be current flatmates of this flat.
  const people = [...new Set(writes.flatMap((w) => w.rotation))];
  if (people.length) {
    const { data: valid } = await supabase
      .from("members")
      .select("id")
      .eq("flat_id", flat.id)
      .eq("role", "flatmate")
      .is("left_on", null)
      .in("id", people);
    if ((valid ?? []).length !== people.length) return { error: "Someone in a rotation isn't in this flat any more. Reload and try again." };
  }

  if (deletes.length) {
    const { error } = await supabase.from("chores").delete().eq("flat_id", flat.id).in("id", deletes);
    if (error) return { error: "The chores couldn't be saved. Try again." };
  }
  for (const w of writes) {
    let choreId = w.id;
    if (choreId) {
      const { error } = await supabase.from("chores").update(w.row).eq("id", choreId).eq("flat_id", flat.id);
      if (error) return { error: `“${w.row.name}” couldn't be saved. Try again.` };
      await supabase.from("chore_rotation").delete().eq("chore_id", choreId).eq("flat_id", flat.id);
    } else {
      const { data, error } = await supabase.from("chores").insert({ ...w.row, flat_id: flat.id }).select("id").single();
      if (error || !data) return { error: `“${w.row.name}” couldn't be added. Try again.` };
      choreId = data.id;
    }
    const { error: rotErr } = await supabase
      .from("chore_rotation")
      .insert(w.rotation.map((member_id, position) => ({ chore_id: choreId, member_id, flat_id: flat.id, position })));
    if (rotErr) return { error: `The rotation for “${w.row.name}” couldn't be saved. Try again.` };
  }

  revalidatePath("/", "layout");
  redirect("/chores?saved=all");
}
