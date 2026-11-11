import { MEALS, MEAL_LABEL, type Meal } from "@/lib/engine/presence";
import type { DayPlan } from "@/lib/engine/menu";
import type { MenuDay } from "@/lib/supabase/types";
import { UsersIcon } from "./icons";
import { cx } from "./ui";

/** "breakfast", "lunch and dinner", ... for sentences. */
export function mealsPhrase(meals: readonly Meal[]): string {
  const names = meals.map((m) => MEAL_LABEL[m].toLowerCase());
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Breakfast, lunch and dinner for one day, each with its own headcount (SPEC §4.4). */
export function MealList({
  day,
  counts,
  noCookMeals,
  plans,
}: {
  day: Pick<MenuDay, Meal> | null | undefined;
  counts: Record<Meal, number>;
  noCookMeals: readonly Meal[];
  /** Each meal's Order in / We'll cook choice. */
  plans?: Record<Meal, DayPlan>;
}) {
  return (
    <dl className="flex flex-col divide-y divide-line">
      {MEALS.map((meal) => {
        const dish = day?.[meal];
        const noCook = noCookMeals.includes(meal);
        return (
          <div key={meal} className="grid grid-cols-[5.25rem_1fr_auto] items-baseline gap-x-3 py-2.5">
            <dt className="text-sm font-semibold text-muted">{MEAL_LABEL[meal]}</dt>
            <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className={cx("min-w-0", dish ? "font-semibold" : "text-muted")}>{dish ?? "Not planned"}</span>
              {noCook ? (
                <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-bold text-warn-ink">
                  No cook{plans?.[meal] === "order_in" ? " · ordering in" : plans?.[meal] === "self_cook" ? " · we're cooking" : ""}
                </span>
              ) : plans?.[meal] && plans[meal] !== "cook" ? (
                // Decided earlier (e.g. while the cook was on leave): still show it.
                <span className="rounded-full bg-info-bg px-2 py-0.5 text-xs font-bold text-info-ink">
                  {plans[meal] === "order_in" ? "Ordering in" : "We’re cooking"}
                </span>
              ) : null}
            </dd>
            <dd className="inline-flex items-center gap-1 self-center rounded-full bg-sunk px-2 py-0.5 text-xs font-bold text-accent-dark tabular-nums">
              <UsersIcon size={13} />
              {counts[meal]}
              <span className="sr-only"> eating</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
