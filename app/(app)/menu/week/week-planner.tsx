"use client";

import { useActionState, useEffect, useState } from "react";
import { MEALS, MEAL_LABEL, type Meal } from "@/lib/engine/presence";
import { formatShortDate } from "@/lib/engine/calendar";
import { Button, Notice, cx } from "@/components/ui";
import { CopyIcon, RepeatIcon, XIcon } from "@/components/icons";
import { saveWeek, type WeekFormState } from "../actions";

export type Dishes = Record<Meal, string>;

const EMPTY: Dishes = { breakfast: "", lunch: "", dinner: "" };
const PLACEHOLDER: Dishes = { breakfast: "e.g. Idli", lunch: "e.g. Sambar rice", dinner: "e.g. Chapati" };
const same = (a: Dishes[], b: Dishes[]) => a.every((d, i) => MEALS.every((m) => d[m].trim() === b[i][m].trim()));

const toolClass =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-bold " +
  "hover:border-ink/40 hover:bg-bg active:bg-line disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent disabled:text-muted";

/**
 * The whole week's breakfast, lunch and dinner on one screen. "Copy last week"
 * and "Use usual menu" fill the days still to come; nothing is saved until
 * Save week.
 */
export function WeekPlanner({
  monday,
  dates,
  today,
  initial,
  lastWeek,
  usual,
}: {
  monday: string;
  dates: string[];
  today: string;
  initial: Dishes[];
  lastWeek: Dishes[] | null;
  usual: Dishes[] | null;
}) {
  const [state, action, pending] = useActionState(saveWeek, {} as WeekFormState);
  const [values, setValues] = useState(initial);
  const [undo, setUndo] = useState<{ message: string; prev: Dishes[] } | null>(null);
  const [saveAsUsual, setSaveAsUsual] = useState(false);

  const editable = dates.map((d) => d >= today);
  const anyEditable = editable.some(Boolean);
  const dirty = !same(values, initial);
  const blank = values.every((d, i) => !editable[i] || MEALS.every((m) => !d[m].trim()));

  // Warn before leaving with unsaved dishes.
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const fill = (source: Dishes[], message: string) => {
    setUndo({ message, prev: values });
    setValues((cur) => cur.map((d, i) => (editable[i] ? { ...source[i] } : d)));
  };

  const setDish = (i: number, meal: Meal, dish: string) =>
    setValues((cur) => cur.map((d, j) => (j === i ? { ...d, [meal]: dish } : d)));

  const payload = JSON.stringify({
    monday,
    days: dates.map((date, i) => ({ date, ...values[i] })),
    saveAsUsual,
  });

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="payload" value={payload} />

      {anyEditable ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Fill the week">
            <button
              type="button"
              className={toolClass}
              disabled={!lastWeek}
              onClick={() => lastWeek && fill(lastWeek, "Filled from last week.")}
            >
              <CopyIcon size={18} />
              Copy last week
            </button>
            <button
              type="button"
              className={toolClass}
              disabled={!usual}
              onClick={() => usual && fill(usual, "Filled from your usual menu.")}
            >
              <RepeatIcon size={18} />
              Use usual menu
            </button>
            <button
              type="button"
              className={toolClass}
              disabled={blank}
              onClick={() => fill(dates.map(() => EMPTY), "Cleared the week.")}
            >
              <XIcon size={18} />
              Clear
            </button>
          </div>
          {!lastWeek || !usual ? (
            <p className="text-sm text-muted">
              {!usual
                ? "No usual menu yet. Tick “Save as our usual menu” when you save, and reuse it any week."
                : "Nothing was planned last week, so there is nothing to copy."}
            </p>
          ) : null}
        </div>
      ) : null}

      {undo ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl bg-accent-tint py-1.5 pr-1.5 pl-4 text-sm font-semibold text-accent-dark"
        >
          <span>
            {undo.message} {anyEditable ? "Check the dishes, then save." : null}
          </span>
          <button
            type="button"
            onClick={() => {
              setValues(undo.prev);
              setUndo(null);
            }}
            className="min-h-11 shrink-0 rounded-full px-4 font-bold underline-offset-4 hover:bg-surface hover:underline"
          >
            Undo
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:gap-0 lg:overflow-hidden lg:rounded-[var(--radius-card)] lg:bg-surface">
        {/* Column headings for the desktop table. */}
        <div aria-hidden="true" className="hidden grid-cols-[10rem_1fr_1fr_1fr] gap-3 border-b border-line px-5 py-3 lg:grid">
          <span />
          {MEALS.map((m) => (
            <span key={m} className="text-sm font-bold text-muted">
              {MEAL_LABEL[m]}
            </span>
          ))}
        </div>

        {dates.map((date, i) => {
          const isToday = date === today;
          const locked = !editable[i];
          return (
            <div
              key={date}
              role="group"
              aria-labelledby={`${date}-day`}
              className={cx(
                "flex min-w-0 flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-4",
                "lg:grid lg:grid-cols-[10rem_1fr_1fr_1fr] lg:items-center lg:gap-3 lg:rounded-none lg:border-b lg:border-line lg:px-5 lg:py-3 lg:last:border-b-0",
                isToday && "ring-2 ring-accent lg:ring-0 lg:bg-accent-tint/40",
                locked && "bg-surface/60",
              )}
            >
              <span className="mb-1 flex items-center gap-2 font-bold lg:mb-0">
                  <span id={`${date}-day`} className={locked ? "text-muted" : undefined}>
                    {formatShortDate(date)}
                  </span>
                  {isToday ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">Today</span>
                  ) : locked ? (
                    <span className="text-xs font-semibold text-muted">Past</span>
                  ) : null}
                </span>
              {MEALS.map((meal) => {
                const id = `menu-${date}-${meal}`;
                return (
                  <div key={meal} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 lg:block">
                    <label htmlFor={id} className="text-sm font-semibold text-muted lg:sr-only">
                      {MEAL_LABEL[meal]}
                    </label>
                    <input
                      id={id}
                      disabled={locked}
                      value={values[i][meal]}
                      onChange={(e) => setDish(i, meal, e.target.value)}
                      maxLength={80}
                      placeholder={locked ? "Not planned" : PLACEHOLDER[meal]}
                      autoComplete="off"
                      className={cx(
                        "min-h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-muted/70",
                        "hover:border-ink/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
                        "disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-muted lg:disabled:px-3",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {anyEditable ? (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[calc(var(--radius-card)+4px)] border border-line bg-surface/95 py-2 pr-2 pl-3 shadow-[0_8px_30px_rgb(0_0_0/0.08)] backdrop-blur-md lg:bottom-6 lg:mx-0 lg:py-3 lg:pr-3 lg:pl-5">
          {state.error ? (
            <div className="basis-full">
              <Notice tone="warn">{state.error}</Notice>
            </div>
          ) : null}
          <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm font-semibold leading-tight">
            <input
              type="checkbox"
              checked={saveAsUsual}
              onChange={(e) => setSaveAsUsual(e.target.checked)}
              className="size-5 accent-[var(--color-accent)]"
            />
            Save as our usual menu
          </label>
          <Button type="submit" loading={pending} disabled={!dirty && !saveAsUsual} className="min-h-12 max-w-fit shrink-0 px-6 lg:min-w-48">
            {dirty || !saveAsUsual ? "Save week" : "Save usual menu"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
