"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, todayIn } from "@/lib/engine/dates";
import { weekDates, weekStart } from "@/lib/engine/menu";

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

const WeekPayload = z.object({
  monday: Date_,
  days: z
    .array(z.object({ date: Date_, breakfast: Dish, lunch: Dish, dinner: Dish }))
    .length(7),
  saveAsUsual: z.boolean(),
});

export type WeekFormState = { error?: string };

/**
 * The whole week's meals in one save (SPEC §4.4). Past days are left as they
 * were; with `saveAsUsual` the seven days also become the flat's usual menu.
 * Only the menu owner (or the admin while none is set).
 */
export async function saveWeek(_prev: WeekFormState, form: FormData): Promise<WeekFormState> {
  const { flat, me } = await requireFlat();
  const canPlan = flat.menu_owner_id ? flat.menu_owner_id === me.id : me.is_admin;
  if (!canPlan) return { error: "Only the menu owner can plan meals." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Something went wrong. Reload the page and try again." };
  }
  const parsed = WeekPayload.safeParse(raw);
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === "too_big" && i.path.length === 3);
    return { error: tooLong ? "Keep each dish under 81 characters." : "Something went wrong. Reload the page and try again." };
  }
  const { days, saveAsUsual } = parsed.data;
  const monday = weekStart(parsed.data.monday);
  const expected = weekDates(monday);
  if (days.some((d, i) => d.date !== expected[i])) return { error: "Something went wrong. Reload the page and try again." };

  const supabase = await createClient();
  const today = todayIn(flat.timezone);
  const editable = days.filter((d) => d.date >= today);
  const { data: existing } = await supabase
    .from("menu_days")
    .select("date")
    .eq("flat_id", flat.id)
    .gte("date", monday)
    .lte("date", expected[6]);
  const has = new Set((existing ?? []).map((d) => d.date));
  // Write days that have a dish, and clear days that had a row before.
  const rows = editable
    .filter((d) => has.has(d.date) || d.breakfast || d.lunch || d.dinner)
    .map((d) => ({ flat_id: flat.id, date: d.date, breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner }));
  if (rows.length) {
    const { error } = await supabase.from("menu_days").upsert(rows, { onConflict: "flat_id,date" });
    if (error) return { error: "The menu couldn't be saved. Try again." };
  }

  if (saveAsUsual) {
    const { error } = await supabase.from("menu_templates").upsert(
      days.map((d, i) => ({
        flat_id: flat.id,
        weekday: i + 1,
        breakfast: d.breakfast,
        lunch: d.lunch,
        dinner: d.dinner,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "flat_id,weekday" },
    );
    if (error) return { error: "The week was saved, but not as your usual menu. Try again." };
  }

  revalidatePath("/", "layout");
  redirect(`/menu?w=${monday}&saved=week`);
}
