// Called by the app with the signed-in user's JWT right after the cook or
// maid is marked on leave. Alerts the rest of the flat (SPEC §4.9).
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatRange } from "../_shared/engine/calendar.ts";
import { sendToMembers } from "../_shared/push.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const { awayPeriodId } = (await req.json().catch(() => ({}))) as { awayPeriodId?: string };
  if (!awayPeriodId) return new Response("Missing awayPeriodId", { status: 400 });

  // Read as the caller: RLS proves they belong to this flat.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: period } = await asUser
    .from("away_periods")
    .select("flat_id, member_id, start_date, end_date, full_day, created_by")
    .eq("id", awayPeriodId)
    .maybeSingle();
  if (!period) return new Response("Not found", { status: 404 });

  const { data: staff } = await admin.from("members").select("name, role").eq("id", period.member_id).single();
  if (!staff || staff.role === "flatmate") return Response.json({ sent: 0 });

  let query = admin
    .from("members")
    .select("id")
    .eq("flat_id", period.flat_id)
    .eq("role", "flatmate")
    .is("left_on", null);
  if (period.created_by) query = query.neq("id", period.created_by);
  const { data: flatmates } = await query;

  const when = formatRange(period.start_date, period.end_date);
  const part = period.full_day ? "" : " for part of the day";
  const payload =
    staff.role === "cook"
      ? { title: `No cook ${when}`, body: `${staff.name} is on leave${part}. Order in or cook yourselves?`, url: "/menu" }
      : { title: `No maid ${when}`, body: `${staff.name} is on leave${part}. Cleaning is on us.`, url: "/chores" };

  const result = await sendToMembers(admin, (flatmates ?? []).map((m) => m.id), {
    ...payload,
    tag: `leave-${awayPeriodId}`,
  });
  return Response.json(result);
});
