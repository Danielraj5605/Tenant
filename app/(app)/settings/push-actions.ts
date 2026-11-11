"use server";

import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { callNotify } from "@/lib/notify";

const Subscription = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscription(raw: unknown): Promise<{ ok: boolean }> {
  const { me, flat } = await requireFlat();
  const sub = Subscription.safeParse(raw);
  if (!sub.success) return { ok: false };
  const supabase = await createClient();
  // Same device re-subscribing (or a new member on a shared phone) replaces the row.
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    flat_id: flat.id,
    member_id: me.id,
    endpoint: sub.data.endpoint,
    p256dh: sub.data.keys.p256dh,
    auth: sub.data.keys.auth,
  });
  return { ok: !error };
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { me } = await requireFlat();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("member_id", me.id);
}

/** Push a test message to my own devices, so I can see notifications arrive outside the app. */
export async function sendTestNotification(): Promise<{ ok: boolean; message: string }> {
  const { me } = await requireFlat();
  const result = await callNotify({ testMemberId: me.id });
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not-configured"
          ? "Notifications aren't set up on the server yet. Ask the admin."
          : "The test couldn't be sent. Check your connection and try again.",
    };
  }
  return result.sent > 0
    ? { ok: true, message: "Sent. It should pop up on this device in a few seconds, even with Tenant closed." }
    : { ok: false, message: "No device is set up for you yet. Turn notifications on first." };
}
