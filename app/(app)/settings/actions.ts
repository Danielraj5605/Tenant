"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireFlat } from "@/lib/flat";
import { MemberEditInput, StaffInput } from "@/lib/engine/inputs";
import { Password } from "@/lib/engine/onboarding";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/** Change your own password (needs the current one). */
export async function changePassword(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const { userId } = await requireFlat();
  const current = String(form.get("current") ?? "");
  const next = Password.safeParse(form.get("password") ?? "");
  if (!next.success) return { fieldErrors: { password: next.error.issues[0]?.message } };
  const supabase = await createClient();
  const { data: user } = await supabase.from("app_users").select("password_hash").eq("id", userId).single();
  if (!user || !(await verifyPassword(current, user.password_hash))) {
    return { fieldErrors: { current: "That isn't your current password." } };
  }
  const { error } = await supabase
    .from("app_users")
    .update({ password_hash: await hashPassword(next.data) })
    .eq("id", userId);
  return error ? { error: "The password couldn't be saved. Try again." } : { ok: "Password changed." };
}

/** Admin: set a new password for a flatmate who forgot theirs. */
export async function resetMemberPassword(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const { me, flat } = await requireFlat();
  if (!me.is_admin) return { error: ADMIN_ONLY };
  const memberId = z.uuid().safeParse(form.get("memberId"));
  const next = Password.safeParse(form.get("password") ?? "");
  if (!memberId.success) return { error: "Pick a flatmate." };
  if (!next.success) return { fieldErrors: { password: next.error.issues[0]?.message } };
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .eq("id", memberId.data)
    .eq("flat_id", flat.id)
    .maybeSingle();
  if (!member?.user_id) return { error: "This member doesn't have an account." };
  const { error } = await supabase
    .from("app_users")
    .update({ password_hash: await hashPassword(next.data), failed_attempts: 0, locked_until: null })
    .eq("id", member.user_id);
  return error
    ? { error: "The password couldn't be reset. Try again." }
    : { ok: "Password reset. Tell them the new password; they can change it in Settings." };
}

export type SettingsFormState = { error?: string; ok?: string; fieldErrors?: Record<string, string | undefined> };

const ADMIN_ONLY = "Only the flat admin can change this.";

export async function addStaff(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const { me, flat } = await requireFlat();
  if (!me.is_admin) return { error: ADMIN_ONLY };
  const parsed = StaffInput.safeParse({ name: form.get("name") ?? "", role: form.get("role") ?? "" });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { name: fe.name?.[0], role: fe.role?.[0] } };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("members")
    .select("sort_order")
    .eq("flat_id", flat.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("members").insert({
    flat_id: flat.id,
    name: parsed.data.name,
    role: parsed.data.role,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { error: "The member couldn't be added. Try again." };

  revalidatePath("/", "layout");
  return { ok: `${parsed.data.name} added as ${parsed.data.role}.` };
}

export async function updateMember(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const { me, flat } = await requireFlat();
  if (!me.is_admin) return { error: ADMIN_ONLY };
  const parsed = MemberEditInput.safeParse({
    memberId: form.get("memberId") ?? "",
    name: form.get("name") ?? "",
    leftOn: form.get("leftOn") ?? "",
    role: form.get("role") ?? "",
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { name: fe.name?.[0], leftOn: fe.leftOn?.[0], role: fe.role?.[0] } };
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("id", parsed.data.memberId)
    .eq("flat_id", flat.id)
    .maybeSingle();
  if (!member) return { error: "This member isn't in your flat." };
  // Only the cook and maid can switch roles; flatmates stay flatmates.
  const role = member.role !== "flatmate" && parsed.data.role ? parsed.data.role : member.role;
  const { error } = await supabase
    .from("members")
    .update({ name: parsed.data.name, left_on: parsed.data.leftOn, role })
    .eq("id", parsed.data.memberId)
    .eq("flat_id", flat.id);
  if (error) {
    return error.message.includes("members_left_after_joined")
      ? { fieldErrors: { leftOn: "This is before they joined the flat." } }
      : { error: "The changes couldn't be saved. Try again." };
  }

  revalidatePath("/", "layout");
  redirect("/settings");
}

/** Admin: accept or decline someone asking to join with the flat code. */
export async function decideJoinRequest(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const { me, userId } = await requireFlat();
  if (!me.is_admin) return { error: ADMIN_ONLY };
  const id = z.uuid().safeParse(form.get("requestId"));
  const accept = form.get("decision") === "accept";
  if (!id.success) return { error: "That request wasn't found." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_join_request", {
    p_user_id: userId,
    p_request_id: id.data,
    p_accept: accept,
  });
  if (error) {
    if (error.message.includes("already belong")) return { error: "They joined another flat in the meantime." };
    if (error.message.includes("already handled")) return { error: "This request was already handled." };
    return { error: "That didn't work. Try again." };
  }

  // The request card disappears once handled, so the result shows at the top of Settings.
  revalidatePath("/", "layout");
  redirect(`/settings?request=${accept ? "accepted" : "declined"}`);
}

/**
 * Admin: remove a member. With history (bills, duties, away days) they are marked
 * as left from yesterday; without, they're deleted.
 */
export async function removeMember(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const { me, userId } = await requireFlat();
  if (!me.is_admin) return { error: ADMIN_ONLY };
  const id = z.uuid().safeParse(form.get("memberId"));
  if (!id.success) return { error: "Pick a member." };
  if (id.data === me.id) return { error: "You can't remove yourself." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_member", { p_user_id: userId, p_member_id: id.data });
  if (error || !data) return { error: "They couldn't be removed. Try again." };

  revalidatePath("/", "layout");
  redirect(`/settings?removed=${data}`);
}

export async function setMenuOwner(_prev: SettingsFormState, form: FormData): Promise<SettingsFormState> {
  const { me, flat } = await requireFlat();
  if (!me.is_admin) return { error: ADMIN_ONLY };
  const raw = String(form.get("menuOwnerId") ?? "");
  const id = raw === "" ? null : z.uuid().safeParse(raw).data;
  if (id === undefined) return { error: "Choose a flatmate." };

  const supabase = await createClient();
  const { error } = await supabase.from("flats").update({ menu_owner_id: id }).eq("id", flat.id);
  if (error) return { error: "The menu owner couldn't be saved. Try again." };

  revalidatePath("/", "layout");
  return { ok: "Menu owner saved." };
}
