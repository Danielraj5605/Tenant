"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Password } from "@/lib/engine/onboarding";
import { Button, Field, Notice } from "./ui";

/** Set or change the password for the signed-in account. */
export function PasswordSetup({ signInName }: { signInName: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const p = Password.safeParse(password);
    if (!p.success) return setError(p.error.issues[0]?.message);
    setError(undefined);
    setStatus("saving");
    const { error: err } = await createClient().auth.updateUser({ password: p.data });
    setStatus(err ? "failed" : "saved");
    if (!err) setPassword("");
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        You sign in as <span className="font-bold text-ink">{signInName}</span>.
      </p>
      {status === "saved" ? <Notice tone="success">Password saved. Use it next time you sign in.</Notice> : null}
      {status === "failed" ? <Notice tone="warn">The password couldn&rsquo;t be saved. Try again.</Notice> : null}
      <Field
        id="newPassword"
        label="New password"
        hint="At least 8 characters."
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <Button type="submit" variant="secondary" loading={status === "saving"}>
        Save password
      </Button>
    </form>
  );
}
