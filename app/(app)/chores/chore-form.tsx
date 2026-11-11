"use client";

import { startTransition, useActionState, useState } from "react";
import type { ChoreFrequency } from "@/lib/supabase/types";
import { Avatar, Button, Field, Notice, cx } from "@/components/ui";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "@/components/icons";
import { saveChore, type ChoreFormState } from "./actions";
import { defaultStartMonth, dueDateIn, ordinal } from "@/lib/engine/monthly";
import { formatMonth, formatShortDate, shiftMonth } from "@/lib/engine/calendar";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FREQUENCIES: { value: ChoreFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Some days" },
  { value: "monthly", label: "Monthly" },
];

const EVERY = [1, 2, 3, 4, 6, 12];

export type ChoreFormValues = {
  id?: string;
  name: string;
  frequency: ChoreFrequency;
  days: number[];
  dueTime: string;
  rotation: string[];
  /** Monthly chores. */
  everyMonths?: number;
  dayOfMonth?: number;
  /** yyyy-mm */
  startMonth?: string;
};

const pill = (active: boolean) =>
  cx(
    "flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-3 text-sm font-bold",
    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
    active ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong bg-surface hover:border-ink/40",
  );

export function ChoreForm({
  flatmates,
  initial,
  today,
  meId,
}: {
  flatmates: { id: string; name: string }[];
  initial: ChoreFormValues;
  /** The flat's today (yyyy-mm-dd), for the monthly first-month choices. */
  today: string;
  /** Default person for a new monthly chore. */
  meId?: string;
}) {
  const [state, action, pending] = useActionState(saveChore, {} as ChoreFormState);
  const [frequency, setFrequency] = useState(initial.frequency);
  const monthly = frequency === "monthly";
  const [everyMonths, setEveryMonths] = useState(initial.everyMonths ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth ?? 5);
  const [startMonth, setStartMonth] = useState(initial.startMonth ?? defaultStartMonth(initial.dayOfMonth ?? 5, today));
  const [startTouched, setStartTouched] = useState(Boolean(initial.startMonth));
  const [owner, setOwner] = useState(
    initial.frequency === "monthly"
      ? (initial.rotation[0] ?? "")
      : meId && flatmates.some((f) => f.id === meId)
        ? meId
        : "",
  );
  const startOptions = Array.from({ length: 12 }, (_, i) => shiftMonth(today.slice(0, 7), i));
  const firstDue = (m: string) => dueDateIn({ every_months: 1, day_of_month: dayOfMonth, start_month: `${m}-01` }, m);
  const [days, setDays] = useState(initial.days);
  const [order, setOrder] = useState(initial.rotation);
  const nameOf = new Map(flatmates.map((f) => [f.id, f.name]));
  const others = flatmates.filter((f) => !order.includes(f.id));

  const toggleDay = (d: number) =>
    setDays((cur) => (frequency === "weekly" ? [d] : cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const move = (i: number, by: -1 | 1) =>
    setOrder((cur) => {
      const next = [...cur];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  return (
    <form
      // Submit without React's automatic form reset, so a refused save keeps what was typed and picked.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-6"
      noValidate
    >
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="rotation" value={JSON.stringify(monthly ? (owner ? [owner] : []) : order)} />
      {monthly ? (
        <>
          <input type="hidden" name="everyMonths" value={everyMonths} />
          <input type="hidden" name="dayOfMonth" value={dayOfMonth} />
          <input type="hidden" name="startMonth" value={startMonth} />
        </>
      ) : null}

      <Field
        id="name"
        name="name"
        label="Chore"
        placeholder="e.g. Garbage"
        maxLength={40}
        defaultValue={initial.name}
        error={state.fieldErrors?.name}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">How often</legend>
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
          {FREQUENCIES.map((f) => (
            <label key={f.value} className={pill(frequency === f.value)}>
              <input
                type="radio"
                name="frequency"
                value={f.value}
                checked={frequency === f.value}
                onChange={() => {
                  setFrequency(f.value);
                  if (f.value === "weekly") setDays((d) => d.slice(0, 1));
                }}
                className="sr-only"
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      {monthly ? (
        <>
          <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
            <SelectField
              id="everyMonths"
              label="Every"
              value={everyMonths}
              onChange={(v) => setEveryMonths(Number(v))}
              error={state.fieldErrors?.everyMonths}
            >
              {EVERY.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Month" : `${n} months`}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="dayOfMonth"
              label="Due by"
              value={dayOfMonth}
              onChange={(v) => {
                setDayOfMonth(Number(v));
                if (!startTouched) setStartMonth(defaultStartMonth(Number(v), today));
              }}
              error={state.fieldErrors?.dayOfMonth}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {`The ${ordinal(d)}${d > 28 ? " (or the last day)" : ""}`}
                </option>
              ))}
            </SelectField>
          </div>
          <SelectField
            id="startMonth"
            label={everyMonths === 1 ? "First one" : `First one (then every ${everyMonths} months)`}
            value={startMonth}
            onChange={(v) => {
              setStartMonth(v);
              setStartTouched(true);
            }}
            error={state.fieldErrors?.startMonth}
          >
            {(startOptions.includes(startMonth) ? startOptions : [startMonth, ...startOptions]).map((m) => (
              <option key={m} value={m}>
                {`${formatMonth(m)}, due ${formatShortDate(firstDue(m))}`}
              </option>
            ))}
          </SelectField>

          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Who does it</legend>
            <p className="mb-2 text-sm text-muted">
              If they can&rsquo;t, they can hand it over to someone else from the Chores page.
            </p>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 md:grid-cols-3">
              {flatmates.map((f) => (
                <label key={f.id} className={cx(pill(owner === f.id), "justify-start gap-2 pl-1.5")}>
                  <input
                    type="radio"
                    name="owner"
                    value={f.id}
                    checked={owner === f.id}
                    onChange={() => setOwner(f.id)}
                    className="sr-only"
                  />
                  <Avatar name={f.name} size={30} />
                  <span className="name-wrap">{f.name}</span>
                </label>
              ))}
            </div>
            {state.fieldErrors?.rotation ? (
              <p className="text-sm font-semibold text-danger" role="alert">
                {state.fieldErrors.rotation}
              </p>
            ) : null}
          </fieldset>
        </>
      ) : null}

      {frequency !== "daily" && !monthly ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{frequency === "weekly" ? "Which day" : "Which days"}</legend>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((label, i) => (
              <label key={label} className={cx(pill(days.includes(i + 1)), "px-0")}>
                <input
                  type={frequency === "weekly" ? "radio" : "checkbox"}
                  name="days"
                  value={i + 1}
                  checked={days.includes(i + 1)}
                  onChange={() => toggleDay(i + 1)}
                  className="sr-only"
                />
                {label.slice(0, 2)}
                <span className="sr-only">{label}</span>
              </label>
            ))}
          </div>
          {state.fieldErrors?.days ? (
            <p className="text-sm font-semibold text-danger" role="alert">
              {state.fieldErrors.days}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {monthly ? null : (
        <Field
          id="dueTime"
          name="dueTime"
          label="Done by (optional)"
          type="time"
          defaultValue={initial.dueTime}
          error={state.fieldErrors?.dueTime}
        />
      )}

      <fieldset className={cx("flex min-w-0 flex-col gap-2", monthly && "hidden")}>
        <legend className="mb-1 text-sm font-semibold">Who takes turns, in order</legend>
        <p className="mb-2 text-sm text-muted">Away people are skipped automatically.</p>
        {order.length ? (
          <ol className="flex flex-col rounded-xl border border-line-strong bg-surface">
            {order.map((id, i) => (
              <li key={id} className="flex min-h-14 items-center gap-1.5 border-b border-line py-1.5 pr-1 pl-2 last:border-b-0">
                <span className="w-4 shrink-0 text-xs font-bold text-muted tabular-nums">{i + 1}</span>
                <span className="shrink-0 max-[359px]:hidden">
                  <Avatar name={nameOf.get(id) ?? "?"} size={30} />
                </span>
                <span className="name-wrap flex-1 font-semibold">{nameOf.get(id) ?? "Former member"}</span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${nameOf.get(id)} up`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg disabled:opacity-30"
                >
                  <ArrowUpIcon size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${nameOf.get(id)} down`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg disabled:opacity-30"
                >
                  <ArrowDownIcon size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setOrder((cur) => cur.filter((x) => x !== id))}
                  aria-label={`Take ${nameOf.get(id) ?? "them"} out of the rotation`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-warn-bg hover:text-danger"
                >
                  <XIcon size={18} />
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        {others.length ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {others.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setOrder((cur) => [...cur, f.id])}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-line-strong px-4 text-sm font-bold hover:border-ink/40"
              >
                Add {f.name}
              </button>
            ))}
          </div>
        ) : null}
        {state.fieldErrors?.rotation ? (
          <p className="text-sm font-semibold text-danger" role="alert">
            {state.fieldErrors.rotation}
          </p>
        ) : null}
      </fieldset>

      <Button type="submit" loading={pending}>
        {initial.id ? "Save chore" : "Add chore"}
      </Button>
    </form>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  error,
  children,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cx(
          "min-h-[52px] w-full min-w-0 rounded-xl border bg-surface px-4 text-base hover:border-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none",
          error ? "border-danger" : "border-line-strong",
        )}
      >
        {children}
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
