"use client";

import { useActionState } from "react";
import { changePassword, resetMemberPassword, type SettingsFormState } from "@/app/(app)/settings/actions";
import { Button, Field, Notice } from "./ui";

/** Change the signed-in account's password. */
export function PasswordSetup({ username }: { username: string }) {
  const [state, action, pending] = useActionState(changePassword, {} as SettingsFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-3" key={state.ok}>
      <p className="text-sm text-muted">
        You sign in as <span className="font-bold text-ink">{username}</span>.
      </p>
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <Field id="current" name="current" label="Current password" type="password" autoComplete="current-password" error={state.fieldErrors?.current} />
      <Field
        id="newPassword"
        name="password"
        label="New password"
        hint="At least 8 characters."
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
      />
      <Button type="submit" variant="secondary" loading={pending}>
        Change password
      </Button>
    </form>
  );
}

/** Admin: give a flatmate a new password. */
export function ResetPasswordForm({ memberId, name }: { memberId: string; name: string }) {
  const [state, action, pending] = useActionState(resetMemberPassword, {} as SettingsFormState);
  return (
    <form action={action} noValidate className="flex flex-col gap-3" key={state.ok}>
      {state.ok ? <Notice tone="success">{state.ok}</Notice> : null}
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="memberId" value={memberId} />
      <Field
        id="resetPassword"
        name="password"
        label={`New password for ${name}`}
        hint="At least 8 characters. Share it with them in person."
        type="text"
        autoComplete="off"
        error={state.fieldErrors?.password}
      />
      <Button type="submit" variant="secondary" loading={pending}>
        Reset password
      </Button>
    </form>
  );
}
