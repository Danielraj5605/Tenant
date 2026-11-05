"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Password, Username, loginEmail, safeNextPath } from "@/lib/engine/onboarding";
import { Button, Field, Notice, cx } from "@/components/ui";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));

  const [mode, setMode] = useState<Mode>(params.get("next")?.startsWith("/join/") ? "signup" : "signin");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const finish = () => {
    router.replace(next);
    router.refresh();
  };

  async function signIn() {
    if (!username.trim() || !password) {
      setErrors({ username: username.trim() ? undefined : "Enter your username", password: password ? undefined : "Enter your password" });
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.signInWithPassword({ email: loginEmail(username), password });
    setBusy(false);
    if (error) {
      setFormError(
        error.status === 429
          ? "Too many attempts. Wait a minute, then try again."
          : "That username and password don't match. Check them and try again.",
      );
      return;
    }
    finish();
  }

  async function signUp() {
    const u = Username.safeParse(username);
    const p = Password.safeParse(password);
    const n = name.trim();
    const fieldErrors = {
      name: n ? undefined : "Enter your name",
      username: u.success ? undefined : u.error.issues[0]?.message,
      password: p.success ? undefined : p.error.issues[0]?.message,
    };
    setErrors(fieldErrors);
    if (!u.success || !p.success || !n) return;

    setBusy(true);
    const { data, error } = await createClient().auth.signUp({
      email: loginEmail(u.data),
      password: p.data,
      options: { data: { full_name: n.slice(0, 40), username: u.data } },
    });
    setBusy(false);
    if (error) {
      setFormError(
        /already|registered|exists/i.test(error.message)
          ? "That username is taken. Pick another one."
          : "The account couldn't be created. Try again.",
      );
      return;
    }
    if (!data.session) {
      // Supabase is still set to confirm emails, which usernames can't receive.
      setFormError("Accounts can't be created yet: the flat admin needs to turn off \"Confirm email\" in Supabase.");
      return;
    }
    finish();
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(undefined);
    void (mode === "signin" ? signIn() : signUp());
  };

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setErrors({});
        setFormError(undefined);
      }}
      aria-pressed={mode === m}
      className={cx(
        "flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-bold",
        mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-full bg-line/70 p-1">
        {tab("signin", "Sign in")}
        {tab("signup", "Create account")}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {formError ? <Notice tone="warn">{formError}</Notice> : null}
        {mode === "signup" ? (
          <Field
            id="name"
            label="Your name"
            hint="Your flatmates see this on chores and splits."
            autoComplete="given-name"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
        ) : null}
        <Field
          id="username"
          label={mode === "signin" ? "Username" : "Choose a username"}
          hint={
            mode === "signup"
              ? "Lowercase letters and numbers, like daniel or priya_k."
              : "Joined with an email link earlier? Use that email here."
          }
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={errors.username}
        />
        <div className="flex flex-col gap-1.5">
          <Field
            id="password"
            label={mode === "signin" ? "Password" : "Choose a password"}
            hint={mode === "signup" ? "At least 8 characters." : undefined}
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="min-h-11 w-fit rounded-full px-1 text-sm font-bold text-accent hover:underline"
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>
        </div>
        <Button type="submit" loading={busy}>
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
