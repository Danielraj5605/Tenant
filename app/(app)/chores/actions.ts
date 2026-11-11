"use server";

import { loadChoreWeek } from "@/lib/chores";
import { isPresent } from "@/lib/engine/presence";
import { openTurns, swapExpired, swapProblem } from "@/lib/engine/swaps";
import { todayIn } from "@/lib/engine/dates";
import { after } from "next/server";
import { callNotify } from "@/lib/notify";
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
    everyMonths: form.get("everyMonths") || undefined,
    dayOfMonth: form.get("dayOfMonth") || undefined,
    startMonth: form.get("startMonth") || undefined,
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        name: fe.name?.[0],
        days: fe.days?.[0],
        dueTime: fe.dueTime?.[0],
        rotation: fe.rotation?.[0],
        everyMonths: fe.everyMonths?.[0],
        dayOfMonth: fe.dayOfMonth?.[0],
        startMonth: fe.startMonth?.[0],
      },
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
    .is("left_on", null)
    .in("id", v.rotation);
  if ((valid ?? []).length !== v.rotation.length) return { error: "Someone in the rotation isn't in this flat any more. Reload and try again." };
  const row = {
    name: v.name,
    frequency: v.frequency,
    days_of_week: v.days,
    due_time: v.dueTime,
    every_months: v.everyMonths,
    day_of_month: v.dayOfMonth,
    start_month: v.startMonth,
  };

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

  // A monthly chore's new owner takes over the turns not done yet.
  if (v.frequency === "monthly") {
    await supabase
      .from("chore_assignments")
      .update({ member_id: v.rotation[0] })
      .eq("chore_id", choreId)
      .eq("flat_id", flat.id)
      .eq("status", "pending");
  }

  revalidatePath("/", "layout");
  redirect("/chores");
}

export type HandOverState = { error?: string };

/**
 * Monthly chore: the person on duty (or the admin) hands this turn to someone
 * else. "From now on" also makes them the chore's owner for later months.
 */
export async function handOverDuty(_prev: HandOverState, form: FormData): Promise<HandOverState> {
  const { me, flat } = await requireFlat();
  const assignmentId = z.uuid().safeParse(form.get("assignmentId"));
  const to = z.uuid().safeParse(form.get("to"));
  const always = form.get("always") === "true";
  if (!assignmentId.success) return { error: "Something went wrong. Reload and try again." };
  if (!to.success) return { error: "Pick who takes it over." };

  const supabase = await createClient();
  const [{ data: duty }, { data: person }] = await Promise.all([
    supabase
      .from("chore_assignments")
      .select("id, chore_id, member_id, status")
      .eq("id", assignmentId.data)
      .eq("flat_id", flat.id)
      .maybeSingle(),
    supabase
      .from("members")
      .select("id, name")
      .eq("id", to.data)
      .eq("flat_id", flat.id)
      .eq("role", "flatmate")
      .is("left_on", null)
      .maybeSingle(),
  ]);
  if (!duty) return { error: "This turn no longer exists. Reload and try again." };
  // The person on duty, the admin, or anyone when the person on duty has left the flat.
  let assigneeLeft = false;
  if (duty.member_id && duty.member_id !== me.id && !me.is_admin) {
    const { data: assignee } = await supabase.from("members").select("left_on").eq("id", duty.member_id).maybeSingle();
    assigneeLeft = !assignee || (assignee.left_on !== null && assignee.left_on < todayIn(flat.timezone));
  }
  if (!(me.is_admin || duty.member_id === me.id || assigneeLeft)) {
    return { error: "Only the person on duty or the admin can hand this over." };
  }
  if (duty.status !== "pending") return { error: "This is already done." };
  if (!person) return { error: "Pick someone who lives in the flat." };
  if (person.id === duty.member_id) return { error: `It's already ${person.id === me.id ? "yours" : `${person.name}'s`}.` };

  const { error } = await supabase
    .from("chore_assignments")
    .update({ member_id: person.id })
    .eq("id", duty.id)
    .eq("flat_id", flat.id)
    .eq("status", "pending");
  if (error) return { error: "It couldn't be handed over. Try again." };

  if (always) {
    await supabase.from("chore_rotation").delete().eq("chore_id", duty.chore_id).eq("flat_id", flat.id);
    const { error: rotErr } = await supabase
      .from("chore_rotation")
      .insert({ chore_id: duty.chore_id, member_id: person.id, flat_id: flat.id, position: 0 });
    if (rotErr) return { error: "This turn moved, but later months couldn't be changed. Edit the chore to set who does it." };
  }

  after(() => callNotify({ handOver: { assignmentId: duty.id, fromMemberId: me.id, always } }));

  revalidatePath("/", "layout");
  // Said at the top of Chores: the card itself may no longer show the hand-over control.
  redirect(`/chores?handed=${person.id}${always ? "&always=1" : ""}`);
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
  const { userId, me } = await requireFlat();
  const id = z.uuid().safeParse(form.get("assignmentId"));
  const done = form.get("done") === "true";
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_chore_done", { p_user_id: userId, p_assignment_id: id.data, p_done: done });
  // Done (not undo): tell the rest of the flat.
  if (!error && done) after(() => callNotify({ choreDone: { assignmentId: id.data, byMemberId: me.id } }));
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
  const writes: {
    id: string | null;
    row: {
      name: string;
      frequency: "daily" | "weekly" | "custom";
      days_of_week: number[];
      due_time: string | null;
      every_months: null;
      day_of_month: null;
      start_month: null;
    };
    rotation: string[];
  }[] = [];
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
      // This screen only edits weekday chores, so monthly settings are cleared.
      row: { name: v.name, frequency, days_of_week: v.days, due_time: v.dueTime, every_months: null, day_of_month: null, start_month: null },
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

  // One transaction: every change is saved, or none is.
  const { error } = await supabase.rpc("save_chores", {
    p_flat_id: flat.id,
    p: {
      deletes,
      writes: writes.map((w) => ({
        id: w.id,
        name: w.row.name,
        frequency: w.row.frequency,
        days_of_week: w.row.days_of_week,
        due_time: w.row.due_time,
        rotation: w.rotation,
      })),
    },
  });
  if (error) {
    return {
      error: error.message.includes("no longer in this flat")
        ? "Some of these chores are no longer in this flat. Reload and try again."
        : "The chores couldn't be saved, so nothing was changed. Try again.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/chores?saved=all");
}

export type MenuPlannerState = { error?: string };

/**
 * "Plan the menu" chore: the person who has it, or the admin, hands it to
 * another flatmate. When nobody has it (or they left), any flatmate can choose.
 */
export async function setMenuPlanner(_prev: MenuPlannerState, form: FormData): Promise<MenuPlannerState> {
  const { me, flat } = await requireFlat();
  const to = z.uuid().safeParse(form.get("to"));
  if (!to.success) return { error: "Pick who plans the menu." };
  const supabase = await createClient();
  const today = todayIn(flat.timezone);
  const [{ data: person }, { data: owner }] = await Promise.all([
    supabase.from("members").select("id, name").eq("id", to.data).eq("flat_id", flat.id).eq("role", "flatmate").is("left_on", null).maybeSingle(),
    flat.menu_owner_id
      ? supabase.from("members").select("id, left_on").eq("id", flat.menu_owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!person) return { error: "Pick someone who lives in the flat." };
  const vacant = !owner || (owner.left_on !== null && owner.left_on < today);
  if (!(vacant || owner?.id === me.id || me.is_admin)) {
    return { error: "Only the person who plans the menu or the admin can hand it over." };
  }
  if (!vacant && owner?.id === person.id) return { error: `${person.id === me.id ? "You already plan" : `${person.name} already plans`} the menu.` };

  const { error } = await supabase.from("flats").update({ menu_owner_id: person.id }).eq("id", flat.id);
  if (error) return { error: "It couldn't be saved. Try again." };
  if (person.id !== me.id) after(() => callNotify({ menuPlanner: { toMemberId: person.id, fromMemberId: me.id } }));

  revalidatePath("/", "layout");
  redirect(`/chores?menu=${person.id}`);
}

export type SwapState = { error?: string };

/** The chore's open turns this week and a "home that day" check, for swap rules. */
async function swapContext(flatId: string, today: string, choreId: string) {
  const { views, members, periods } = await loadChoreWeek(flatId, today);
  const view = views.find((v) => v.chore.id === choreId);
  if (!view) return null;
  const byId = new Map(members.map((m) => [m.id, m]));
  return {
    view,
    turns: openTurns(today, view.today, view.upcoming),
    isHome: (memberId: string, date: string) => {
      const m = byId.get(memberId);
      return Boolean(m && isPresent(m, date, periods));
    },
  };
}

/** Ask to swap one of my days on a chore for someone else's day; they accept or decline. */
export async function requestSwap(_prev: SwapState, form: FormData): Promise<SwapState> {
  const { me, flat } = await requireFlat();
  const choreId = z.uuid().safeParse(form.get("choreId"));
  const fromDate = z.iso.date().safeParse(form.get("fromDate"));
  const toDate = z.iso.date().safeParse(form.get("toDate"));
  if (!choreId.success) return { error: "Something went wrong. Reload and try again." };
  if (!fromDate.success) return { error: "Pick your day." };
  if (!toDate.success) return { error: "Pick their day." };
  const today = todayIn(flat.timezone);
  const ctx = await swapContext(flat.id, today, choreId.data);
  if (!ctx) return { error: "This chore no longer exists." };
  const toMember = ctx.turns.find((t) => t.date === toDate.data)?.memberId;
  if (!toMember) return { error: "Nobody has that day." };
  const problem = swapProblem({
    turns: ctx.turns,
    fromMember: me.id,
    fromDate: fromDate.data,
    toMember,
    toDate: toDate.data,
    today,
    isHome: ctx.isHome,
  });
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chore_swaps")
    .insert({ flat_id: flat.id, chore_id: choreId.data, from_member: me.id, from_date: fromDate.data, to_member: toMember, to_date: toDate.data })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.code === "23505" ? "One of these days already has a swap request waiting." : "The request couldn't be sent. Try again." };
  }
  after(() => callNotify({ swap: { swapId: data.id, event: "requested" } }));
  revalidatePath("/", "layout");
  redirect("/chores?swap=sent#swaps");
}

/** The person asked accepts or declines a swap. */
export async function respondSwap(_prev: SwapState, form: FormData): Promise<SwapState> {
  const { me, flat } = await requireFlat();
  const id = z.uuid().safeParse(form.get("swapId"));
  const accept = form.get("answer") === "accept";
  if (!id.success) return { error: "Something went wrong. Reload and try again." };
  const supabase = await createClient();
  const { data: swap } = await supabase.from("chore_swaps").select("*").eq("id", id.data).eq("flat_id", flat.id).maybeSingle();
  if (!swap || swap.status !== "pending") return { error: "This request is no longer open." };
  if (swap.to_member !== me.id) return { error: "Only the person asked can answer this." };
  const today = todayIn(flat.timezone);
  if (swapExpired(swap, today)) return { error: "One of these days has passed, so this request has expired." };

  if (!accept) {
    await supabase.from("chore_swaps").update({ status: "declined", decided_at: new Date().toISOString() }).eq("id", swap.id).eq("status", "pending");
    after(() => callNotify({ swap: { swapId: swap.id, event: "declined" } }));
    revalidatePath("/", "layout");
    redirect("/chores?swap=declined#swaps");
  }

  // Both turns must still be as they were when asked.
  const ctx = await swapContext(flat.id, today, swap.chore_id);
  if (!ctx) return { error: "This chore no longer exists." };
  const problem = swapProblem({
    turns: ctx.turns,
    fromMember: swap.from_member,
    fromDate: swap.from_date,
    toMember: swap.to_member,
    toDate: swap.to_date,
    today,
    isHome: ctx.isHome,
  });
  if (problem) {
    // Turns moved (someone went away, or the rotation changed) since it was asked.
    return { error: "This swap no longer works: the days have changed since it was asked. Decline it, and they can ask again." };
  }
  // Keep whose turn each day was by the rotation, so the rotation doesn't shift.
  const { data: rows } = await supabase
    .from("chore_assignments")
    .select("due_date, member_id, rotation_member_id")
    .eq("chore_id", swap.chore_id)
    .in("due_date", [swap.from_date, swap.to_date]);
  const rotationOn = (date: string, fallback: string) => {
    const r = (rows ?? []).find((x) => x.due_date === date);
    return r?.rotation_member_id ?? r?.member_id ?? fallback;
  };
  const { error } = await supabase.rpc("accept_chore_swap", {
    p_swap_id: swap.id,
    p_from_rotation: rotationOn(swap.from_date, swap.from_member),
    p_to_rotation: rotationOn(swap.to_date, swap.to_member),
  });
  if (error) return { error: "The swap couldn't be saved, so nothing changed. Try again." };
  after(() => callNotify({ swap: { swapId: swap.id, event: "accepted" } }));
  revalidatePath("/", "layout");
  redirect("/chores?swap=accepted#swaps");
}

/** Withdraw my own request while it's waiting. */
export async function cancelSwap(_prev: SwapState, form: FormData): Promise<SwapState> {
  const { me, flat } = await requireFlat();
  const id = z.uuid().safeParse(form.get("swapId"));
  if (!id.success) return { error: "Something went wrong. Reload and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chore_swaps")
    .update({ status: "cancelled", decided_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("flat_id", flat.id)
    .eq("from_member", me.id)
    .eq("status", "pending")
    .select("id");
  if (error || !data?.length) return { error: "This request is no longer open." };
  revalidatePath("/", "layout");
  redirect("/chores?swap=cancelled#swaps");
}
