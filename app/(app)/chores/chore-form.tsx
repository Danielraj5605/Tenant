"use client";

import { useActionState, useState } from "react";
import type { ChoreFrequency } from "@/lib/supabase/types";
import { Avatar, Button, Field, Notice, cx } from "@/components/ui";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { saveChore, type ChoreFormState } from "./actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FREQUENCIES: { value: ChoreFrequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Once a week" },
  { value: "custom", label: "Chosen days" },
];

export type ChoreFormValues = {
  id?: string;
  name: string;
  frequency: ChoreFrequency;
  days: number[];
  dueTime: string;
  rotation: string[];
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
}: {
  flatmates: { id: string; name: string }[];
  initial: ChoreFormValues;
}) {
  const [state, action, pending] = useActionState(saveChore, {} as ChoreFormState);
  const [frequency, setFrequency] = useState(initial.frequency);
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
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="rotation" value={JSON.stringify(order)} />

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
        <div className="grid grid-cols-3 gap-2">
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

      {frequency !== "daily" ? (
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

      <Field
        id="dueTime"
        name="dueTime"
        label="Done by (optional)"
        type="time"
        defaultValue={initial.dueTime}
        error={state.fieldErrors?.dueTime}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Who takes turns, in order</legend>
        <p className="mb-2 text-sm text-muted">Away people are skipped automatically.</p>
        {order.length ? (
          <ol className="flex flex-col rounded-xl border border-line-strong bg-surface">
            {order.map((id, i) => (
              <li key={id} className="flex min-h-14 items-center gap-2 border-b border-line px-3 last:border-b-0">
                <span className="w-5 text-sm font-bold text-muted">{i + 1}</span>
                <Avatar name={nameOf.get(id) ?? "?"} size={32} />
                <span className="flex-1 truncate font-semibold">{nameOf.get(id) ?? "Former member"}</span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${nameOf.get(id)} up`}
                  className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-bg disabled:opacity-30"
                >
                  <ArrowUpIcon size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${nameOf.get(id)} down`}
                  className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-bg disabled:opacity-30"
                >
                  <ArrowDownIcon size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setOrder((cur) => cur.filter((x) => x !== id))}
                  className="min-h-11 rounded-full px-2 text-sm font-bold text-danger hover:bg-warn-bg"
                >
                  Remove
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
