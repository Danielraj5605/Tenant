"use client";

import { useFormStatus } from "react-dom";
import type { MenuPlan } from "@/lib/supabase/types";
import { setPlan } from "@/app/(app)/menu/actions";
import { cx } from "./ui";

const LABEL: Record<Exclude<MenuPlan, "cook">, string> = { order_in: "Ordering in", self_cook: "We're cooking" };

function PlanButton({ plan, children, primary }: { plan: MenuPlan; children: React.ReactNode; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="plan"
      value={plan}
      disabled={pending}
      className={cx(
        "min-h-11 flex-1 rounded-full px-4 text-sm font-bold disabled:opacity-60",
        primary ? "bg-warn-ink text-white hover:bg-warn-ink/90" : "border border-warn-ink/30 bg-surface text-warn-ink hover:bg-warn-bg",
      )}
    >
      {children}
    </button>
  );
}

/** "No cook" card with Order in / We'll cook (SPEC §4.4). */
export function NoCookCard({ date, plan, label }: { date: string; plan: MenuPlan; label: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-warn-bg px-4 py-3 text-warn-ink">
      <p className="font-bold">
        {plan === "cook" ? `No cook ${label}. Order in or cook yourselves?` : `No cook ${label}. ${LABEL[plan]}.`}
      </p>
      <form action={setPlan} className="flex gap-2">
        <input type="hidden" name="date" value={date} />
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
      </form>
    </div>
  );
}
