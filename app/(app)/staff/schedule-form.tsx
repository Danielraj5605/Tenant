"use client";

import { useActionState, useState } from "react";
import { Button, Notice, cx } from "@/components/ui";
import { MEALS, MEAL_LABEL, type Meal } from "@/lib/engine/presence";
import {
  WEEKDAYS,
  everyDay,
  nextOnWeekday,
  nextWorkingOn,
  type DayMode,
  type DayPlan,
  type WorkSchedule,
} from "@/lib/engine/schedule";
import { saveSchedule, type StaffFormState } from "./actions";

const MODES: { value: DayMode; label: string }[] = [
  { value: "every", label: "Weekly" },
  { value: "alternate", label: "Alternate" },
  { value: "off", label: "Off" },
];

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** A choice drawn as a pill; the real control is a visually hidden radio or checkbox. */
function Choice({
  type,
  name,
  checked,
  onChange,
  children,
  className,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-3 text-sm font-semibold transition-colors select-none",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        checked ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong text-ink hover:border-ink/40",
        className,
      )}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

export function ScheduleForm({
  member,
  today,
}: {
  member: { id: string; name: string; role: "cook" | "maid"; work_schedule: WorkSchedule | null };
  today: string;
}) {
  const [state, action, pending] = useActionState(saveSchedule, {} as StaffFormState);
  const isCook = member.role === "cook";
  // Alternate days start on their next working date, so the right option is picked.
  const [week, setWeek] = useState<WorkSchedule>(() =>
    (member.work_schedule ?? everyDay()).map((d) =>
      d.mode === "alternate" && d.anchor ? { ...d, anchor: nextWorkingOn(d.anchor, today) } : d,
    ),
  );

  const setDay = (i: number, change: Partial<DayPlan>) =>
    setWeek((w) => w.map((d, j) => (j === i ? { ...d, ...change } : d)));

  const pickMode = (i: number, mode: DayMode) =>
    setDay(i, {
      mode,
      // Alternate: default to the next date on that weekday; the cook needs at least one meal.
      anchor: mode === "alternate" ? (week[i].anchor ?? nextOnWeekday(i, today, 1)[0]) : null,
      meals: mode !== "off" && week[i].meals.length === 0 ? [...MEALS] : week[i].meals,
    });

  const toggleMeal = (i: number, meal: Meal) =>
    setDay(i, {
      meals: week[i].meals.includes(meal) ? week[i].meals.filter((m) => m !== meal) : MEALS.filter((m) => m === meal || week[i].meals.includes(m)),
    });

  const workingDays = week.filter((d) => d.mode !== "off" && (!isCook || d.meals.length)).length;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="memberId" value={member.id} />
      <input type="hidden" name="schedule" value={JSON.stringify(week)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {workingDays === 7 ? "Works every day." : workingDays === 0 ? "No working days set." : `Works ${workingDays} ${workingDays === 1 ? "day" : "days"} a week.`}
        </p>
        <button
          type="button"
          onClick={() => setWeek(everyDay())}
          className="-mr-2 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
        >
          Reset to every day
        </button>
      </div>

      <ul className="flex flex-col">
        {week.map((d, i) => {
          const dates = nextOnWeekday(i, today, 2);
          const noMeals = isCook && d.mode !== "off" && d.meals.length === 0;
          return (
            <li key={WEEKDAYS[i]} className="flex flex-col gap-3 border-b border-line py-4 first:pt-0 last:border-b-0 last:pb-0">
              <fieldset className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                <legend className="float-left mb-1 w-full font-bold md:mb-0 md:w-28 md:shrink-0">{WEEKDAYS[i]}</legend>
                <div className="grid flex-1 grid-cols-3 gap-2">
                  {MODES.map((m) => (
                    <Choice
                      key={m.value}
                      type="radio"
                      name={`mode-${i}`}
                      checked={d.mode === m.value}
                      onChange={() => pickMode(i, m.value)}
                      className="px-1"
                    >
                      {m.label}
                    </Choice>
                  ))}
                </div>
              </fieldset>

              {d.mode === "alternate" ? (
                <fieldset className="flex flex-col gap-2 md:pl-32">
                  <legend className="mb-2 text-sm font-semibold text-muted">Which week do they come?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {dates.map((date, k) => (
                      <Choice
                        key={date}
                        type="radio"
                        name={`anchor-${i}`}
                        checked={d.anchor === date}
                        onChange={() => setDay(i, { anchor: date })}
                      >
                        {k === 0 ? "This" : "Next"} {WEEKDAYS[i].slice(0, 3)}, {shortDate(date)}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {isCook && d.mode !== "off" ? (
                <fieldset className="flex flex-col gap-2 md:pl-32">
                  <legend className="mb-2 text-sm font-semibold text-muted">Cooks</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {MEALS.map((meal) => (
                      <Choice
                        key={meal}
                        type="checkbox"
                        name={`meal-${i}-${meal}`}
                        checked={d.meals.includes(meal)}
                        onChange={() => toggleMeal(i, meal)}
                        className="px-1"
                      >
                        {MEAL_LABEL[meal]}
                      </Choice>
                    ))}
                  </div>
                  {noMeals ? (
                    <p className="text-sm font-semibold text-danger" role="alert">
                      Pick at least one meal, or set {WEEKDAYS[i]} to Off.
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Button type="submit" loading={pending} disabled={week.some((d) => isCook && d.mode !== "off" && d.meals.length === 0)}>
        Save schedule
      </Button>
    </form>
  );
}
