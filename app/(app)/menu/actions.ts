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

/** Lunch and dinner. Only the menu owner (or the admin while none is set); enforced in SQL. */
export async function saveDishes(_prev: MenuFormState, form: FormData): Promise<MenuFormState> {
  const { flat } = await requireFlat();
  const date = Date_.safeParse(form.get("date"));
  const lunch = Dish.safeParse(form.get("lunch") ?? "");
  const dinner = Dish.safeParse(form.get("dinner") ?? "");
  if (!date.success) return { error: "Pick a day." };
  if (!lunch.success || !dinner.success) {
    return {
      fieldErrors: {
        lunch: lunch.success ? undefined : lunch.error.issues[0]?.message,
        dinner: dinner.success ? undefined : dinner.error.issues[0]?.message,
      },
    };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_days")
    .upsert({ flat_id: flat.id, date: date.data, lunch: lunch.data, dinner: dinner.data }, { onConflict: "flat_id,date" });
  if (error) {
    return {
      error: error.message.includes("menu owner")
        ? "Only the menu owner can plan meals."
        : "The menu couldn't be saved. Try again.",
    };
  }
  revalidatePath("/", "layout");
  redirect(`/menu?w=${weekStart(date.data)}`);
}
