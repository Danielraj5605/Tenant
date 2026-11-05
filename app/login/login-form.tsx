"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/engine/onboarding";
import { Button, Field, Notice } from "@/components/ui";
import { GoogleMark, MailIcon } from "@/components/icons";

const Email = z.string().trim().email("Enter a valid email address");

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const linkFailed = params.get("error") === "link";

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [googleLoading, setGoogleLoading] = useState(false);

  const callbackUrl = () => {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  };

  async function signInWithGoogle() {
    setGoogleLoading(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setGoogleLoading(false);
      setStatus({ kind: "error", message: "Google sign-in isn't available right now. Try the email link instead." });
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Email.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message);
      return;
    }
    setEmailError(undefined);
    setStatus({ kind: "sending" });
    const { error } = await createClient().auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) {
      const message =
        error.status === 429
          ? "Too many sign-in emails were sent. Wait a few minutes, then try again."
          : "The sign-in email couldn't be sent. Check the address and try again.";
      setStatus({ kind: "error", message });
      return;
    }
    setStatus({ kind: "sent", email: parsed.data });
  }

  if (status.kind === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success">
          Check {status.email} for a sign-in link. Open it on this phone to continue.
        </Notice>
        <Button variant="ghost" onClick={() => setStatus({ kind: "idle" })}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {linkFailed && status.kind === "idle" ? (
        <Notice tone="warn">That sign-in link has expired or was already used. Request a new one below.</Notice>
      ) : null}
      {status.kind === "error" ? <Notice tone="warn">{status.message}</Notice> : null}

      <Button variant="secondary" onClick={signInWithGoogle} loading={googleLoading}>
        {googleLoading ? null : <GoogleMark />}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={sendMagicLink} noValidate className="flex flex-col gap-4">
        <Field
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <Button type="submit" loading={status.kind === "sending"}>
          {status.kind === "sending" ? null : <MailIcon size={20} />}
          Email me a sign-in link
        </Button>
      </form>
    </div>
  );
}
