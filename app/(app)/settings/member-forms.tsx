"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Notice, cx } from "@/components/ui";
import {
  decideJoinRequest,
  handOverAdmin,
  removeMember,
  setUsualSkips,
  setMenuOwner,
  updateMember,
  type SettingsFormState,
} from "./actions";

const initial: SettingsFormState = {};

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

function SubmitButton({ children, className, variant = "secondary", name, value }: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // Only the pressed button shows the spinner.
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <Button type="submit" variant={variant} loading={mine} disabled={pending && !mine} className={className} name={name} value={value}>
      {children}
    </Button>
  );
}

/** Admin: remove a member, with a confirm step that says what will happen. */
export function RemoveMemberButton({ memberId, name, hasLogin }: { memberId: string; name: string; hasLogin: boolean }) {
  const [state, action] = useActionState(removeMember, initial);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" className="text-danger hover:bg-warn-bg" onClick={() => setConfirming(true)}>
        Remove {name} from the flat
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <p className="font-semibold">Remove {name}?</p>
      <p className="text-sm text-muted">
        From today they aren&rsquo;t counted for chores, meals or new splits{hasLogin ? " and can no longer open the flat" : ""}.
        Past bills and history stay as they are.
      </p>
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Keep
        </Button>
        <SubmitButton className="border-danger text-danger hover:bg-warn-bg">Yes, remove</SubmitButton>
      </div>
    </form>
  );
}

/** Admin: one pending join request with Accept and Decline. */
export function JoinRequestItem({ id, name, username, when }: { id: string; name: string; username: string; when: string }) {
  const [state, action] = useActionState(decideJoinRequest, initial);
  return (
    <li className="flex flex-col gap-3 border-b border-line py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{name}</span>
          <span className="text-sm text-muted">
            @{username} · asked {when}
          </span>
        </span>
      </div>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <form action={action} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="requestId" value={id} />
        <SubmitButton name="decision" value="decline">
          Decline
        </SubmitButton>
        <SubmitButton name="decision" value="accept" variant="primary">
          Accept
        </SubmitButton>
      </form>
    </li>
  );
}

const MEALS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
] as const;

/** "I usually skip": meal headcounts leave you out of these. */
export function UsualSkipsForm({ current }: { current: readonly string[] }) {
  const [state, action] = useActionState(setUsualSkips, initial);
  const [skips, setSkips] = useState<string[]>([...current]);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">I usually skip</legend>
        <div className="grid grid-cols-3 gap-2">
          {MEALS.map((m) => {
            const on = skips.includes(m.value);
            return (
              <label
                key={m.value}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  on ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong hover:border-ink/40",
                )}
              >
                <input
                  type="checkbox"
                  name="skips"
                  value={m.value}
                  checked={on}
                  onChange={() => setSkips((s) => (on ? s.filter((x) => x !== m.value) : [...s, m.value]))}
                  className="sr-only"
                />
                {m.label}
              </label>
            );
          })}
        </div>
        <p className="text-sm text-muted">The cook sees fewer people for those meals. For a one-off, mark yourself away for part of the day instead.</p>
      </fieldset>
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

/** Admin: hand admin rights to this flatmate, with a confirm step. */
export function HandOverAdminButton({ memberId, name }: { memberId: string; name: string }) {
  const [state, action] = useActionState(handOverAdmin, initial);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Make {name} the admin
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <p className="font-semibold">Make {name} the admin?</p>
      <p className="text-sm text-muted">
        {name} will accept join requests, manage members and fix anyone&rsquo;s entries. You&rsquo;ll become a regular
        flatmate.
      </p>
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <SubmitButton variant="primary">Yes, hand over</SubmitButton>
      </div>
    </form>
  );
}
