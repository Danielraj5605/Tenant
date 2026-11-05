"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/engine/dates";
import { weekStart } from "@/lib/engine/menu";

const Date_ = z.string().refine(isIsoDate);
const Dish = z
  .string()
  .trim()
  .max(80, "Keep it under 81 characters")
  .transform((v) => (v ? v : null));

export type MenuFormState = { error?: string; fieldErrors?: Record<string, string | undefined> };

/** Order in / We'll cook / back to the cook. Any flatmate can choose. */
export async function setPlan(form: FormData) {
  const { flat } = await requireFlat();
  const date = Date_.safeParse(form.get("date"));
  const plan = z.enum(["cook", "order_in", "self_cook"]).safeParse(form.get("plan"));
  if (!date.success || !plan.success) return;
  const supabase = await createClient();
  await supabase
    .from("menu_days")
    .upsert({ flat_id: flat.id, date: date.data, plan: plan.data }, { onConflict: "flat_id,date" });
  revalidatePath("/", "layout");
}

/** Breakfast, lunch and dinner. Only the menu owner (or the admin while none is set). */
export async function saveDishes(_prev: MenuFormState, form: FormData): Promise<MenuFormState> {
  const { flat, me } = await requireFlat();
  const canPlan = flat.menu_owner_id ? flat.menu_owner_id === me.id : me.is_admin;
  if (!canPlan) return { error: "Only the menu owner can plan meals." };
  const date = Date_.safeParse(form.get("date"));
  const breakfast = Dish.safeParse(form.get("breakfast") ?? "");
  const lunch = Dish.safeParse(form.get("lunch") ?? "");
  const dinner = Dish.safeParse(form.get("dinner") ?? "");
  if (!date.success) return { error: "Pick a day." };
  if (!breakfast.success || !lunch.success || !dinner.success) {
    return {
      fieldErrors: {
        breakfast: breakfast.success ? undefined : breakfast.error.issues[0]?.message,
        lunch: lunch.success ? undefined : lunch.error.issues[0]?.message,
        dinner: dinner.success ? undefined : dinner.error.issues[0]?.message,
      },
    };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_days")
    .upsert({ flat_id: flat.id, date: date.data, breakfast: breakfast.data, lunch: lunch.data, dinner: dinner.data }, { onConflict: "flat_id,date" });
  if (error) return { error: "The menu couldn't be saved. Try again." };
  revalidatePath("/", "layout");
  redirect(`/menu?w=${weekStart(date.data)}`);
}
