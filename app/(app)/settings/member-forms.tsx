"use client";

import { useActionState, useState } from "react";
import { Button, Field, Notice, cx } from "@/components/ui";
import { addStaff, setMenuOwner, updateMember, type SettingsFormState } from "./actions";

const initial: SettingsFormState = {};

export function AddStaffForm() {
  const [state, action, pending] = useActionState(addStaff, initial);
  const [role, setRole] = useState<"cook" | "maid">("cook");

  return (
    <form action={action} className="flex flex-col gap-4" noValidate key={state.ok}>
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Role</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["cook", "maid"] as const).map((r) => (
            <label
              key={r}
              className={cx(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-full border font-semibold",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                role === r ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong hover:border-ink/40",
              )}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              {r === "cook" ? "Cook" : "Maid"}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="staffName" name="name" label="Name" maxLength={40} autoComplete="off" error={state.fieldErrors?.name} />
      <Button type="submit" variant="secondary" loading={pending}>
        Add {role}
      </Button>
    </form>
  );
}

export function MenuOwnerForm({
  flatmates,
  current,
}: {
  flatmates: { id: string; name: string }[];
  current: string | null;
}) {
  const [state, action, pending] = useActionState(setMenuOwner, initial);
  const [value, setValue] = useState(current ?? "");

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <label htmlFor="menuOwnerId" className="text-sm font-semibold">
        Plans lunch and dinner
      </label>
      <select
        id="menuOwnerId"
        name="menuOwnerId"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[52px] rounded-xl border border-line-strong bg-surface px-4 text-base hover:border-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
      >
        <option value="">Nobody yet</option>
        {flatmates.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" loading={pending} disabled={value === (current ?? "")}>
        Save menu owner
      </Button>
    </form>
  );
}

export function EditMemberForm({
  member,
}: {
  member: { id: string; name: string; joined_on: string; left_on: string | null };
}) {
  const [state, action, pending] = useActionState(updateMember, initial);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="memberId" value={member.id} />
      <Field
        id="name"
        name="name"
        label="Name"
        maxLength={40}
        defaultValue={member.name}
        error={state.fieldErrors?.name}
      />
      <Field
        id="leftOn"
        name="leftOn"
        label="Moved out on (optional)"
        hint="From the day after this date they're no longer counted anywhere. Leave empty while they live here."
        type="date"
        min={member.joined_on}
        defaultValue={member.left_on ?? ""}
        error={state.fieldErrors?.leftOn}
      />
      <Button type="submit" loading={pending}>
        Save changes
      </Button>
    </form>
  );
}
