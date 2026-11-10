"use client";

import { useActionState, useState } from "react";
import type { MemberRole } from "@/lib/supabase/types";
import { Avatar, Button, Field, Notice, cx } from "@/components/ui";
import { ROLE_LABEL } from "@/components/away";
import { MEALS, MEAL_LABEL, MEAL_SLOT, SLOT_LABEL, type AwaySlot } from "@/lib/engine/presence";
import { saveAway, type AwayFormState } from "./actions";

export type AwayFormMember = { id: string; name: string; role: MemberRole };

export type AwayFormValues = {
  id?: string;
  memberId: string;
  startDate: string;
  endDate: string;
  fullDay: boolean;
  slots: AwaySlot[];
  reason: string;
};

export function AwayForm({
  members,
  initial,
  from,
}: {
  members: AwayFormMember[];
  initial: AwayFormValues;
  /** "staff" when opened from the Cook & maid page, to return there after saving. */
  from?: "staff";
}) {
  const [state, action, pending] = useActionState(saveAway, {} as AwayFormState);
  const [memberId, setMemberId] = useState(initial.memberId);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [fullDay, setFullDay] = useState(initial.fullDay);
  const [slots, setSlots] = useState<AwaySlot[]>(initial.slots);
  const chosen = members.find((m) => m.id === memberId);

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {from ? <input type="hidden" name="from" value={from} /> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Who is away?</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const checked = m.id === memberId;
            return (
              <label
                key={m.id}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-4 pl-1 font-semibold",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  checked ? "border-accent bg-surface text-accent-dark ring-1 ring-accent" : "border-line-strong bg-surface hover:border-ink/40",
                )}
              >
                <input
                  type="radio"
                  name="memberId"
                  value={m.id}
                  checked={checked}
                  onChange={() => setMemberId(m.id)}
                  className="sr-only"
                />
                <Avatar name={m.name} size={34} />
                {m.name}
                {m.role !== "flatmate" ? <span className="text-sm font-medium text-muted">{ROLE_LABEL[m.role]}</span> : null}
              </label>
            );
          })}
        </div>
        {state.fieldErrors?.memberId ? (
          <p className="text-sm font-semibold text-danger" role="alert">
            {state.fieldErrors.memberId}
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="startDate"
          name="startDate"
          label="From"
          type="date"
          value={startDate}
          onChange={(e) => {
            const v = e.target.value;
            setStartDate(v);
            if (v && (!fullDay || !endDate || endDate < v)) setEndDate(v);
          }}
          error={state.fieldErrors?.startDate}
        />
        <Field
          id="endDate"
          name="endDate"
          label="Until"
          type="date"
          min={startDate || undefined}
          value={fullDay ? endDate : startDate}
          readOnly={!fullDay}
          hint={fullDay ? undefined : "Same day"}
          onChange={(e) => setEndDate(e.target.value)}
          error={state.fieldErrors?.endDate}
        />
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="fullDay"
          value="true"
          checked={fullDay}
          onChange={(e) => {
            setFullDay(e.target.checked);
            // Part of the day is for one day only.
            if (!e.target.checked) setEndDate(startDate);
          }}
          className="mt-0.5 size-6 shrink-0 accent-accent"
        />
        <span className="flex flex-col">
          <span className="font-semibold">Away the whole day</span>
          <span className="text-sm text-muted">
            {chosen?.role === "cook"
              ? "Untick if she still works part of the day. Part days are paid in full; full days off are unpaid."
              : "Untick if they're only out for part of one day."}
          </span>
        </span>
      </label>

      {fullDay ? null : (
        <fieldset className="flex flex-col gap-2" aria-describedby="slots-hint">
          <legend className="mb-1 text-sm font-semibold">Which part of the day?</legend>
          <p id="slots-hint" className="mb-1 text-sm text-muted">
            {chosen?.role === "cook"
              ? "No cook for these meals. The rest of the day she cooks as usual."
              : chosen?.role === "maid"
                ? "Shown on the calendar so the flat knows when she's out."
                : "They're left out of the headcount for these meals. Chores and splits treat them as home."}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {MEALS.map((meal) => {
              const slot = MEAL_SLOT[meal];
              const checked = slots.includes(slot);
              return (
                <label
                  key={slot}
                  className={cx(
                    "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-xl border px-2 py-2 text-center",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                    checked ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong bg-surface hover:border-ink/40",
                  )}
                >
                  <input
                    type="checkbox"
                    name="slots"
                    value={slot}
                    checked={checked}
                    onChange={(e) =>
                      setSlots((cur) => (e.target.checked ? [...cur, slot] : cur.filter((s) => s !== slot)))
                    }
                    className="sr-only"
                  />
                  <span className="font-bold">{SLOT_LABEL[slot]}</span>
                  <span className={cx("text-xs font-semibold", checked ? "text-accent-dark" : "text-muted")}>
                    {MEAL_LABEL[meal]}
                  </span>
                </label>
              );
            })}
          </div>
          {state.fieldErrors?.slots && slots.length === 0 ? (
            <p className="text-sm font-semibold text-danger" role="alert">
              {state.fieldErrors.slots}
            </p>
          ) : null}
        </fieldset>
      )}

      <Field
        id="reason"
        name="reason"
        label="Reason (optional)"
        placeholder="e.g. Going home for Diwali"
        maxLength={120}
        defaultValue={initial.reason}
        error={state.fieldErrors?.reason}
      />

      <Button type="submit" loading={pending}>
        {initial.id ? "Save changes" : "Mark away"}
      </Button>
    </form>
  );
}
