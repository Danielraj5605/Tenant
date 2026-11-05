"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { createFlat, openInvite, type FormState } from "./actions";

const initial: FormState = {};

export function CreateFlatForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState(createFlat, initial);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <Field
        id="flatName"
        name="flatName"
        label="Flat name"
        placeholder="e.g. Flat 4B, Anna Nagar"
        autoComplete="off"
        maxLength={60}
        defaultValue={state.values?.flatName}
        error={state.fieldErrors?.flatName}
        required
      />
      <Field
        id="memberName"
        name="memberName"
        label="Your name"
        hint="Your flatmates see this on chores and splits."
        autoComplete="given-name"
        maxLength={40}
        defaultValue={state.values?.memberName ?? suggestedName}
        error={state.fieldErrors?.memberName}
        required
      />
      <Button type="submit" loading={pending}>
        Create flat
      </Button>
    </form>
  );
}

export function OpenInviteForm() {
  const [state, action, pending] = useActionState(openInvite, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field
        id="invite"
        name="invite"
        label="Invite link"
        placeholder="https://…/join/…"
        autoComplete="off"
        inputMode="url"
        defaultValue={state.values?.invite}
        error={state.fieldErrors?.invite}
      />
      <Button type="submit" variant="secondary" loading={pending}>
        Open invite
      </Button>
    </form>
  );
}
