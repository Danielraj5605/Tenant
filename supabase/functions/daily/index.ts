// Called by pg_cron (see migrations/*_cron.sql) with the x-cron-secret header.
//   job "daily"  (06:00 IST): create today's chore assignments, remind whoever is on duty.
//   job "weekly" (Sun 18:00 IST): ask every flatmate "Away any day next week?"
// Headcount is computed on read (SPEC §5.2), so nothing is precomputed here.
import { createClient } from "npm:@supabase/supabase-js@2";
import { addDays, formatShortDate } from "../_shared/engine/calendar.ts";
import { todayIn } from "../_shared/engine/dates.ts";
import { isoWeekday, planToday } from "../_shared/engine/rotation.ts";
import { sendToMembers } from "../_shared/push.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type FlatRow = { id: string; timezone: string };

async function runDaily(flat: FlatRow) {
  const today = todayIn(flat.timezone);
  const [chores, rotation, history, existing, members, periods] = await Promise.all([
    db.from("chores").select("id, name, frequency, days_of_week").eq("flat_id", flat.id),
    db.from("chore_rotation").select("chore_id, member_id, position").eq("flat_id", flat.id).order("position"),
    db
      .from("chore_assignments")
      .select("chore_id, member_id, due_date")
      .eq("flat_id", flat.id)
      .not("member_id", "is", null)
      .lt("due_date", today)
      .order("due_date", { ascending: false })
      .limit(500),
    db.from("chore_assignments").select("chore_id").eq("flat_id", flat.id).eq("due_date", today),
    db.from("members").select("id, role, joined_on, left_on").eq("flat_id", flat.id),
    db
      .from("away_periods")
      .select("member_id, start_date, end_date, full_day")
      .eq("flat_id", flat.id)
      .lte("start_date", today)
      .gte("end_date", today),
  ]);

  const rotations: Record<string, string[]> = {};
  for (const r of rotation.data ?? []) (rotations[r.chore_id] ??= []).push(r.member_id);
  const lastAssignees: Record<string, string | null> = {};
  for (const h of history.data ?? []) if (!(h.chore_id in lastAssignees)) lastAssignees[h.chore_id] = h.member_id;

  const rows = planToday({
    date: today,
    chores: chores.data ?? [],
    rotations,
    lastAssignees,
    existing: new Set((existing.data ?? []).map((e) => e.chore_id)),
    members: members.data ?? [],
    periods: periods.data ?? [],
  });
  if (rows.length) {
    await db.from("chore_assignments").upsert(
      rows.map((r) => ({
        chore_id: r.choreId,
        flat_id: flat.id,
        member_id: r.memberId,
        due_date: r.date,
        status: r.status,
      })),
      { onConflict: "chore_id,due_date", ignoreDuplicates: true },
    );
  }

  // Remind each person of their pending duties today.
  const { data: duties } = await db
    .from("chore_assignments")
    .select("member_id, chore_id")
    .eq("flat_id", flat.id)
    .eq("due_date", today)
    .eq("status", "pending");
  const choreName = new Map((chores.data ?? []).map((c) => [c.id, c.name as string]));
  const byMember = new Map<string, string[]>();
  for (const d of duties ?? []) {
    if (!d.member_id) continue;
    byMember.set(d.member_id, [...(byMember.get(d.member_id) ?? []), choreName.get(d.chore_id) ?? "A chore"]);
  }
  let sent = 0;
  for (const [memberId, names] of byMember) {
    const r = await sendToMembers(db, [memberId], {
      title: "Your duty today",
      body: names.join(", "),
      url: "/today",
      tag: `duty-${today}`,
    });
    sent += r.sent;
  }
  return { created: rows.length, reminded: byMember.size, sent };
}

async function runWeekly(flat: FlatRow) {
  const today = todayIn(flat.timezone);
  const nextMonday = addDays(today, 8 - isoWeekday(today));
  const { data: flatmates } = await db
    .from("members")
    .select("id")
    .eq("flat_id", flat.id)
    .eq("role", "flatmate")
    .not("user_id", "is", null)
    .or(`left_on.is.null,left_on.gte.${today}`);
  return sendToMembers(
    db,
    (flatmates ?? []).map((m) => m.id),
    {
      title: "Away any day next week?",
      body: `Mark it now so chores and meals adjust from ${formatShortDate(nextMonday)}.`,
      url: `/calendar/away/new?d=${nextMonday}`,
      tag: `weekly-${nextMonday}`,
    },
  );
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Forbidden", { status: 403 });

  const { job } = (await req.json().catch(() => ({}))) as { job?: string };
  if (job !== "daily" && job !== "weekly") return new Response("Unknown job", { status: 400 });

  const { data: flats, error } = await db.from("flats").select("id, timezone");
  if (error) return new Response(error.message, { status: 500 });

  const results: Record<string, unknown> = {};
  for (const flat of (flats ?? []) as FlatRow[]) {
    try {
      results[flat.id] = job === "daily" ? await runDaily(flat) : await runWeekly(flat);
    } catch (err) {
      console.error(flat.id, err);
      results[flat.id] = { error: (err as Error).message };
    }
  }
  return Response.json({ job, results });
});
