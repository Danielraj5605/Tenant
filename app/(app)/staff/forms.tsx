"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, cx } from "@/components/ui";
import { addStaff, updateStaff, type StaffFormState } from "./actions";

const initial: StaffFormState = {};

type StaffRole = "cook" | "maid";

function RolePicker({ role, onChange, error }: { role: StaffRole; onChange: (r: StaffRole) => void; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">Role</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["cook", "maid"] as const).map((r) => (
          <label
            key={r}
            className={cx(
              "flex min-h-11 cursor-pointer items-center justify-center rounded-full border font-semibold transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              role === r ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong hover:border-ink/40",
            )}
          >
            <input type="radio" name="role" value={r} checked={role === r} onChange={() => onChange(r)} className="sr-only" />
            {r === "cook" ? "Cook" : "Maid"}
          </label>
        ))}
      </div>
      {error ? (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const PHONE_HINT = "Optional. Everyone in the flat can tap to call.";

export function AddStaffForm({ suggestRole = "cook" }: { suggestRole?: StaffRole }) {
  const [state, action, pending] = useActionState(addStaff, initial);
  const [role, setRole] = useState<StaffRole>(suggestRole);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate key={state.ok}>
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <RolePicker role={role} onChange={setRole} error={state.fieldErrors?.role} />
      <Field
        id="staffName"
        name="name"
        label="Name"
        maxLength={40}
        autoComplete="off"
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <Field
        id="staffPhone"
        name="phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        maxLength={20}
        placeholder="98765 43210"
        defaultValue={state.values?.phone}
        hint={PHONE_HINT}
        error={state.fieldErrors?.phone}
      />
      <Button type="submit" variant="secondary" loading={pending}>
        Add {role}
      </Button>
    </form>
  );
}

export function EditStaffForm({
  member,
}: {
  member: { id: string; name: string; role: StaffRole; phone: string | null; joined_on: string; left_on: string | null };
}) {
  const [state, action, pending] = useActionState(updateStaff, initial);
  const [role, setRole] = useState<StaffRole>(member.role);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="memberId" value={member.id} />
      <RolePicker role={role} onChange={setRole} error={state.fieldErrors?.role} />
      <Field id="name" name="name" label="Name" maxLength={40} defaultValue={state.values?.name ?? member.name} error={state.fieldErrors?.name} />
      <Field
        id="phone"
        name="phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        maxLength={20}
        placeholder="98765 43210"
        defaultValue={state.values?.phone ?? member.phone ?? ""}
        hint={PHONE_HINT}
        error={state.fieldErrors?.phone}
      />
      <Field
        id="leftOn"
        name="leftOn"
        label="Last working day (optional)"
        hint="After this date they're no longer counted for meals or pay. Leave empty while they work here."
        type="date"
        min={member.joined_on}
        defaultValue={state.values?.leftOn ?? member.left_on ?? ""}
        error={state.fieldErrors?.leftOn}
      />
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
