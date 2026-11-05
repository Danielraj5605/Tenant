"use server";

import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";

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
  await requireFlat();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
