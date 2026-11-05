"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireFlat } from "@/lib/flat";
import { MemberEditInput, StaffInput } from "@/lib/engine/inputs";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { name: fe.name?.[0], leftOn: fe.leftOn?.[0] } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ name: parsed.data.name, left_on: parsed.data.leftOn })
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
