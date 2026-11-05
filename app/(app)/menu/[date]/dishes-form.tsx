"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { saveDishes, type MenuFormState } from "../actions";

export function DishesForm({ date, lunch, dinner }: { date: string; lunch: string; dinner: string }) {
  const [state, action, pending] = useActionState(saveDishes, {} as MenuFormState);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="date" value={date} />
      <Field id="lunch" name="lunch" label="Lunch" placeholder="e.g. Sambar rice, beans poriyal" maxLength={80} defaultValue={lunch} error={state.fieldErrors?.lunch} />
      <Field id="dinner" name="dinner" label="Dinner" placeholder="e.g. Chapati, paneer butter masala" maxLength={80} defaultValue={dinner} error={state.fieldErrors?.dinner} />
      <Button type="submit" loading={pending}>
        Save meals
      </Button>
    </form>
  );
}
