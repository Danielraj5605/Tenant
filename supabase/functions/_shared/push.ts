// Web Push sender shared by Edge Functions. Uses the service role, so call it
// only after checking who is allowed to trigger the message.
import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:you@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** Sends to every subscribed device of the given members; prunes dead subscriptions. */
export async function sendToMembers(db: SupabaseClient, memberIds: string[], payload: PushPayload) {
  if (memberIds.length === 0) return { sent: 0 };
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("member_id", memberIds);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", status, (err as Error).message);
      }
    }),
  );
  return { sent };
}
