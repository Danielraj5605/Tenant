// Called by the Tenant server (x-cron-secret header) right after the cook or
// maid is marked on leave. Alerts the rest of the flat (SPEC §4.9).
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatRange } from "../_shared/engine/calendar.ts";
import { MEALS, MEAL_LABEL, MEAL_SLOT, periodSlots, slotsPhrase } from "../_shared/engine/presence.ts";
import { sendToMembers } from "../_shared/push.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Forbidden", { status: 403 });

  const { awayPeriodId } = (await req.json().catch(() => ({}))) as { awayPeriodId?: string };
  if (!awayPeriodId) return new Response("Missing awayPeriodId", { status: 400 });

  const { data: period } = await admin
    .from("away_periods")
    .select("flat_id, member_id, start_date, end_date, full_day, slots, created_by")
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
  const slots = periodSlots(period);
  const part = period.full_day ? "" : ` ${slotsPhrase(slots)}`;
  const meals = MEALS.filter((m) => slots.includes(MEAL_SLOT[m])).map((m) => MEAL_LABEL[m].toLowerCase());
  const forMeals = period.full_day || meals.length === MEALS.length ? "" : ` for ${meals.join(" and ")}`;
  const payload =
    staff.role === "cook"
      ? { title: `No cook${forMeals} ${when}`, body: `${staff.name} is on leave${part}. Order in or cook yourselves?`, url: "/menu" }
      : { title: `No maid ${when}`, body: `${staff.name} is on leave${part}. Cleaning is on us.`, url: "/chores" };

  const result = await sendToMembers(admin, (flatmates ?? []).map((m) => m.id), {
    ...payload,
    tag: `leave-${awayPeriodId}`,
  });
  return Response.json(result);
});
