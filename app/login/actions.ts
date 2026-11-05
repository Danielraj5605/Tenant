"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "@/lib/auth/server";
import { Password, Username, safeNextPath } from "@/lib/engine/onboarding";

export type LoginState = { error?: string; fieldErrors?: Record<string, string | undefined>; values?: Record<string, string> };

/** Lock an account for a while after this many wrong passwords in a row. */
const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

// Compared against when the username doesn't exist, so timing doesn't reveal it.
let dummyHash: Promise<string> | null = null;

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""));
  const values = { username };
  if (!username || !password) {
    return {
      values,
      fieldErrors: { username: username ? undefined : "Enter your username", password: password ? undefined : "Enter your password" },
    };
  }

  const supabase = await createClient();
  const { data: user } = await supabase
    .from("app_users")
    .select("id, password_hash, failed_attempts, locked_until")
    .eq("username", username)
    .maybeSingle();

  if (!user) {
    await verifyPassword(password, await (dummyHash ??= hashPassword("not-a-real-password")));
    return { values, error: "That username and password don't match. Check them and try again." };
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { values, error: `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes, or ask the admin to reset it.` };
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    const failed = user.failed_attempts + 1;
    await supabase
      .from("app_users")
      .update({
        failed_attempts: failed >= MAX_FAILED ? 0 : failed,
        locked_until: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq("id", user.id);
    return { values, error: "That username and password don't match. Check them and try again." };
  }

  if (user.failed_attempts || user.locked_until) {
    await supabase.from("app_users").update({ failed_attempts: 0, locked_until: null }).eq("id", user.id);
  }
  await startSession(user.id);
  redirect(next);
}

export async function signUp(_prev: LoginState, form: FormData): Promise<LoginState> {
  const name = String(form.get("name") ?? "").trim();
  const u = Username.safeParse(form.get("username") ?? "");
  const p = Password.safeParse(form.get("password") ?? "");
  const next = safeNextPath(String(form.get("next") ?? ""));
  const values = { name, username: String(form.get("username") ?? "") };
  const fieldErrors = {
    name: name ? (name.length > 40 ? "Keep your name under 41 characters" : undefined) : "Enter your name",
    username: u.success ? undefined : u.error.issues[0]?.message,
    password: p.success ? undefined : p.error.issues[0]?.message,
  };
  if (fieldErrors.name || !u.success || !p.success) return { values, fieldErrors };

  const supabase = await createClient();
  const { data: user, error } = await supabase
    .from("app_users")
    .insert({ username: u.data, display_name: name, password_hash: await hashPassword(p.data) })
    .select("id")
    .single();
  if (error || !user) {
    return error?.code === "23505"
      ? { values, fieldErrors: { username: "That username is taken. Pick another one." } }
      : { values, error: "The account couldn't be created. Try again." };
  }

  await startSession(user.id);
  redirect(next);
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
