"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/engine/onboarding";
import { Button, Field, Notice, cx } from "@/components/ui";
import { signIn, signUp, type LoginState } from "./actions";

type Mode = "signin" | "signup";

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [mode, setMode] = useState<Mode>(next.startsWith("/join/") ? "signup" : "signin");

  return (
    <div className="flex flex-col gap-5">
      {params.get("error") === "signed-out" ? (
        <Notice tone="info">Your account no longer exists. Create a new one or sign in again.</Notice>
      ) : null}
      <div className="flex gap-1 rounded-full bg-line/70 p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cx(
              "flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-bold",
              mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {mode === "signin" ? <SignInForm next={next} /> : <SignUpForm next={next} />}
    </div>
  );
}

function PasswordField({ id, label, hint, autoComplete, error }: { id: string; label: string; hint?: string; autoComplete: string; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Field id={id} name="password" label={label} hint={hint} type={show ? "text" : "password"} autoComplete={autoComplete} error={error} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="min-h-11 w-fit rounded-full px-1 text-sm font-bold text-accent hover:underline"
      >
        {show ? "Hide password" : "Show password"}
      </button>
    </div>
  );
}

function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, {} as LoginState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="next" value={next} />
      <Field
        id="username"
        name="username"
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
      />
      <PasswordField id="password" label="Password" autoComplete="current-password" error={state.fieldErrors?.password} />
      <Button type="submit" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, {} as LoginState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="next" value={next} />
      <Field
        id="name"
        name="name"
        label="Your name"
        hint="Your flatmates see this on chores and splits."
        autoComplete="given-name"
        maxLength={40}
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />
      <Field
        id="username"
        name="username"
        label="Choose a username"
        hint="Lowercase letters and numbers, like daniel or priya_k."
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
      />
      <PasswordField
        id="password"
        label="Choose a password"
        hint="At least 8 characters."
        autoComplete="new-password"
        error={state.fieldErrors?.password}
      />
      <Button type="submit" loading={pending}>
        Create account
      </Button>
    </form>
  );
}
