"use client";

import { useActionState, useState } from "react";
import type { MemberRole } from "@/lib/supabase/types";
import { Avatar, Button, Field, Notice, cx } from "@/components/ui";
import { ROLE_LABEL } from "@/components/away";
import { saveAway, type AwayFormState } from "./actions";

export type AwayFormMember = { id: string; name: string; role: MemberRole };

export type AwayFormValues = {
  id?: string;
  memberId: string;
  startDate: string;
  endDate: string;
  fullDay: boolean;
  reason: string;
};

export function AwayForm({ members, initial }: { members: AwayFormMember[]; initial: AwayFormValues }) {
  const [state, action, pending] = useActionState(saveAway, {} as AwayFormState);
  const [memberId, setMemberId] = useState(initial.memberId);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [fullDay, setFullDay] = useState(initial.fullDay);
  const chosen = members.find((m) => m.id === memberId);

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}

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
                  checked ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong bg-surface hover:border-ink/40",
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
            if (v && (!endDate || endDate < v)) setEndDate(v);
          }}
          error={state.fieldErrors?.startDate}
        />
        <Field
          id="endDate"
          name="endDate"
          label="Until"
          type="date"
          min={startDate || undefined}
          value={endDate}
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
          onChange={(e) => setFullDay(e.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-accent"
        />
        <span className="flex flex-col">
          <span className="font-semibold">Away the whole day</span>
          <span className="text-sm text-muted">
            {chosen?.role === "cook"
              ? "Untick if she still works part of the day. Part days are paid in full; full days off are unpaid."
              : "Untick if they're only out for part of the day."}
          </span>
        </span>
      </label>

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
