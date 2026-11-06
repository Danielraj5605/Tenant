"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getFlatContext } from "@/lib/flat";
import { CreateFlatInput, JoinRequestInput } from "@/lib/engine/onboarding";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<"flatName" | "memberName" | "code", string>>;
  values?: Record<string, string>;
  created?: boolean;
};

function rpcMessage(message: string | undefined, fallback: string) {
  if (!message) return fallback;
  if (message.includes("already belong")) return "You already belong to a flat.";
  if (message.includes("No flat has this code")) return "No flat has this code. Check it with your flatmate.";
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

  const { userId } = await getFlatContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_flat", {
    p_user_id: userId,
    p_flat_name: parsed.data.flatName,
    p_member_name: parsed.data.memberName,
  });
  if (error) return { values, error: rpcMessage(error.message, "The flat couldn't be created. Try again.") };

  // The form does a full page load to Settings: the in-app router still holds
  // the "no flat yet → onboarding" redirect and would bounce back.
  return { created: true };
}

/** Ask to join a flat by its code. The admin accepts or declines in Settings. */
export async function requestToJoin(_prev: FormState, form: FormData): Promise<FormState> {
  const values = {
    code: String(form.get("code") ?? ""),
    memberName: String(form.get("memberName") ?? ""),
  };
  const parsed = JoinRequestInput.safeParse(values);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return { values, fieldErrors: { code: fe.code?.[0], memberName: fe.memberName?.[0] } };
  }

  const { userId } = await getFlatContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_to_join", {
    p_user_id: userId,
    p_code: parsed.data.code,
    p_name: parsed.data.memberName,
  });
  if (error) {
    const msg = rpcMessage(error.message, "The request couldn't be sent. Try again.");
    return msg.startsWith("No flat") ? { values, fieldErrors: { code: msg } } : { values, error: msg };
  }

  revalidatePath("/onboarding");
  return {};
}

/** Withdraw your pending join request. */
export async function cancelJoinRequest() {
  const { userId } = await getFlatContext();
  const supabase = await createClient();
  await supabase
    .from("join_requests")
    .update({ status: "cancelled", decided_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending");
  revalidatePath("/onboarding");
}
