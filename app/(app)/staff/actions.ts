"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireFlat } from "@/lib/flat";
import { StaffEditInput, StaffInput } from "@/lib/engine/inputs";

export type StaffFormState = {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string | undefined>;
  /** What was typed, so a failed save doesn't clear the form. */
  values?: Record<string, string>;
};

const typed = (form: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "")]));

/** Any flatmate: add the cook or maid. */
export async function addStaff(_prev: StaffFormState, form: FormData): Promise<StaffFormState> {
  const { flat } = await requireFlat();
  const parsed = StaffInput.safeParse({
    name: form.get("name") ?? "",
    role: form.get("role") ?? "",
    phone: form.get("phone") ?? "",
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return { fieldErrors: { name: fe.name?.[0], role: fe.role?.[0], phone: fe.phone?.[0] }, values: typed(form, ["name", "phone"]) };
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
    phone: parsed.data.phone,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { error: "They couldn't be added. Try again." };

  revalidatePath("/", "layout");
  return { ok: `${parsed.data.name} added as ${parsed.data.role}.` };
}

/** Any flatmate: change the cook's or maid's name, role, phone or last day. */
export async function updateStaff(_prev: StaffFormState, form: FormData): Promise<StaffFormState> {
  const { flat } = await requireFlat();
  const parsed = StaffEditInput.safeParse({
    memberId: form.get("memberId") ?? "",
    name: form.get("name") ?? "",
    role: form.get("role") ?? "",
    phone: form.get("phone") ?? "",
    leftOn: form.get("leftOn") ?? "",
  });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: { name: fe.name?.[0], role: fe.role?.[0], phone: fe.phone?.[0], leftOn: fe.leftOn?.[0] },
      values: typed(form, ["name", "phone", "leftOn"]),
    };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("members")
    .update(
      { name: parsed.data.name, role: parsed.data.role, phone: parsed.data.phone, left_on: parsed.data.leftOn },
      { count: "exact" },
    )
    .eq("id", parsed.data.memberId)
    .eq("flat_id", flat.id)
    // Flatmates' details stay in Settings.
    .neq("role", "flatmate");
  if (error) {
    return error.message.includes("members_left_after_joined")
      ? { fieldErrors: { leftOn: "This is before they started." }, values: typed(form, ["name", "phone", "leftOn"]) }
      : { error: "The changes couldn't be saved. Try again.", values: typed(form, ["name", "phone", "leftOn"]) };
  }
  if (!count) return { error: "This person isn't the flat's cook or maid." };

  revalidatePath("/", "layout");
  redirect("/staff?saved=1");
}
