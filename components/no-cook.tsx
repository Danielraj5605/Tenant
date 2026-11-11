"use client";

import { useFormStatus } from "react-dom";
import { setPlan } from "@/app/(app)/menu/actions";
import { MEAL_LABEL, type Meal } from "@/lib/engine/presence";
import type { DayPlan } from "@/lib/engine/menu";
import { cx } from "./ui";

const DECIDED: Record<Exclude<DayPlan, "cook">, string> = { order_in: "ordering in", self_cook: "we're cooking" };

function PlanButton({ plan, children, primary }: { plan: DayPlan; children: React.ReactNode; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="plan"
      value={plan}
      disabled={pending}
      className={cx(
        "min-h-11 flex-1 rounded-full px-3 text-sm font-bold whitespace-nowrap disabled:opacity-60",
        primary ? "bg-warn-ink text-white hover:bg-warn-ink/90" : "border border-warn-ink/30 bg-surface text-warn-ink hover:bg-warn-bg",
      )}
    >
      {children}
    </button>
  );
}

/** Order in / We'll cook for some meals of a day; a "Switch" button once decided. */
function MealChoice({ date, meals, plan, label }: { date: string; meals: Meal[]; plan: DayPlan; label?: string }) {
  return (
    <form action={setPlan} className="flex flex-col gap-2">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="meals" value={meals.join(",")} />
      {label ? (
        <p className="text-sm font-bold">
          {label}
          {plan !== "cook" ? <span className="font-semibold">: {DECIDED[plan]}</span> : null}
        </p>
      ) : null}
      <div className="flex gap-2">
        {plan === "cook" ? (
          <>
            <PlanButton plan="order_in" primary>
              Order in
            </PlanButton>
            <PlanButton plan="self_cook">We&rsquo;ll cook</PlanButton>
          </>
        ) : (
          <PlanButton plan={plan === "order_in" ? "self_cook" : "order_in"}>
            {plan === "order_in" ? "Switch to we’ll cook" : "Switch to order in"}
          </PlanButton>
        )}
      </div>
    </form>
  );
}

/**
 * "No cook" card (SPEC §4.4): Order in / We'll cook for each meal the cook
 * misses, plus one row for all of them when there are several.
 */
export function NoCookCard({
  date,
  meals,
  plans,
  when,
}: {
  date: string;
  /** Meals with no cook, in day order. */
  meals: Meal[];
  plans: Record<Meal, DayPlan>;
  /** "today", "on Sat 7 Nov", ... */
  when: string;
}) {
  const undecided = meals.filter((m) => plans[m] === "cook");
  const mealsText = meals.map((m) => MEAL_LABEL[m].toLowerCase());
  const which = meals.length === 3 ? "" : ` for ${mealsText.length === 1 ? mealsText[0] : `${mealsText.slice(0, -1).join(", ")} and ${mealsText.at(-1)}`}`;

  if (meals.length === 1) {
    const plan = plans[meals[0]];
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-warn-bg px-4 py-3 text-warn-ink">
        <p className="font-bold">
          {plan === "cook" ? `No cook${which} ${when}. Order in or cook yourselves?` : `No cook${which} ${when}. ${DECIDED[plan][0].toUpperCase()}${DECIDED[plan].slice(1)}.`}
        </p>
        <MealChoice date={date} meals={meals} plan={plan} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-warn-bg px-4 py-3 text-warn-ink">
      <p className="font-bold">
        No cook{which} {when}.{undecided.length ? " Order in or cook yourselves?" : ""}
      </p>
      {undecided.length > 1 ? (
        <MealChoice date={date} meals={undecided} plan="cook" label={undecided.length === meals.length ? `All ${meals.length} meals` : "All undecided meals"} />
      ) : null}
      <div className="flex flex-col gap-3 border-t border-warn-ink/15 pt-3">
        {meals.map((m) => (
          <MealChoice key={m} date={date} meals={[m]} plan={plans[m]} label={MEAL_LABEL[m]} />
        ))}
      </div>
    </div>
  );
}
