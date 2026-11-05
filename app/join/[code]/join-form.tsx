"use client";

import { useActionState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { joinFlat, type FormState } from "@/app/onboarding/actions";

export function JoinForm({ code, suggestedName }: { code: string; suggestedName: string }) {
  const [state, action, pending] = useActionState(joinFlat, {} as FormState);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="code" value={code} />
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
        Join flat
      </Button>
    </form>
  );
}
