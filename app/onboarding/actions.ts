"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateFlatInput, JoinFlatInput, inviteCodeFrom } from "@/lib/engine/onboarding";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<"flatName" | "memberName" | "invite", string>>;
  values?: Record<string, string>;
};

function rpcMessage(message: string | undefined, fallback: string) {
  if (!message) return fallback;
  if (message.includes("already belong")) return "You already belong to a flat.";
  if (message.includes("not valid")) return "This invite link is not valid. Ask for a new one.";
  if (message.includes("Sign in")) return "Your session ended. Sign in again.";
  return fallback;
}

export async function createFlat(_prev: FormState, form: FormData): Promise<FormState> {
  const values = {
    flatName: String(form.get("flatName") ?? ""),
    memberName: String(form.get("memberName") ?? ""),
  };
  const parsed = CreateFlatInput.safeParse(values);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return { values, fieldErrors: { flatName: fe.flatName?.[0], memberName: fe.memberName?.[0] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_flat", {
    p_flat_name: parsed.data.flatName,
    p_member_name: parsed.data.memberName,
  });
  if (error) return { values, error: rpcMessage(error.message, "The flat couldn't be created. Try again.") };

  redirect("/settings?created=1");
}

export async function joinFlat(_prev: FormState, form: FormData): Promise<FormState> {
  const values = {
    code: String(form.get("code") ?? ""),
    memberName: String(form.get("memberName") ?? ""),
  };
  const parsed = JoinFlatInput.safeParse(values);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return { values, error: fe.code?.[0], fieldErrors: { memberName: fe.memberName?.[0] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("join_flat", {
    p_code: parsed.data.code,
    p_member_name: parsed.data.memberName,
  });
  if (error) return { values, error: rpcMessage(error.message, "You couldn't join the flat. Try again.") };

  redirect("/today");
}

/** "Have an invite link?" on onboarding: accepts a link or a code. */
export async function openInvite(_prev: FormState, form: FormData): Promise<FormState> {
  const raw = String(form.get("invite") ?? "");
  const code = inviteCodeFrom(raw);
  if (!code) return { values: { invite: raw }, fieldErrors: { invite: "Paste the full invite link you were sent" } };
  redirect(`/join/${code}`);
}
