import "server-only";

import { supabaseEnv } from "@/lib/supabase/env";

/** What the notify Edge Function can send (see supabase/functions/notify). */
export type NotifyRequest =
  | { awayPeriodId: string }
  | { joinRequestId: string }
  | { expenseId: string }
  | { handOver: { assignmentId: string; fromMemberId: string; always: boolean } }
  | { choreDone: { assignmentId: string; byMemberId: string } }
  | { testMemberId: string };

export type NotifyResult = { ok: true; sent: number } | { ok: false; reason: "not-configured" | "failed" };

/**
 * Asks the notify Edge Function to push a message. Best-effort: callers on a
 * save path run it in `after()` so saving never waits for it.
 */
export async function callNotify(request: NotifyRequest): Promise<NotifyResult> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetch(`${supabaseEnv().url}/functions/v1/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, reason: "failed" };
    const body = (await res.json().catch(() => ({}))) as { sent?: number };
    return { ok: true, sent: body.sent ?? 0 };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
