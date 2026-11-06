"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Notice } from "@/components/ui";
import { cancelJoinRequest, createFlat, requestToJoin, type FormState } from "./actions";

const initial: FormState = {};

export function CreateFlatForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState(createFlat, initial);
  useEffect(() => {
    // Full page load so no page cached from before the flat existed is reused.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load is the point here
    if (state.created) window.location.assign("/settings?created=1");
  }, [state.created]);

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
      <Button type="submit" loading={pending || state.created}>
        Create flat
      </Button>
    </form>
  );
}

export function JoinRequestForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState(requestToJoin, initial);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <Field
        id="code"
        name="code"
        label="Flat code"
        hint="6 characters, e.g. K7M-4QX. Ask the flat admin; it's in their Settings."
        placeholder="K7M-4QX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={9}
        defaultValue={state.values?.code}
        error={state.fieldErrors?.code}
        required
      />
      <Field
        id="joinName"
        name="memberName"
        label="Your name"
        hint="Your flatmates see this on chores and splits."
        autoComplete="given-name"
        maxLength={40}
        defaultValue={state.values?.memberName ?? suggestedName}
        error={state.fieldErrors?.memberName}
        required
      />
      <Button type="submit" variant="secondary" loading={pending}>
        Ask to join
      </Button>
    </form>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" loading={pending}>
      Cancel request
    </Button>
  );
}

/**
 * Waiting for the admin: reloads every 15 seconds and moves on once accepted.
 * A full reload, so no page cached from before they had a flat is reused.
 */
export function PendingRequest({ flatName, name }: { flatName: string; name: string }) {
  useEffect(() => {
    const id = setInterval(() => window.location.reload(), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <Notice tone="success">
        Request sent to {flatName} as {name}. You&rsquo;ll get in as soon as the admin accepts it.
      </Notice>
      <p className="text-sm text-muted">This page checks again by itself. You can close it and come back later.</p>
      <form action={cancelJoinRequest}>
        <CancelButton />
      </form>
    </div>
  );
}
