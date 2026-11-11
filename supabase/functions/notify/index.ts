// Called by the Tenant server (x-cron-secret header):
//   { awayPeriodId }  right after the cook or maid is marked on leave: alerts the rest of the flat (SPEC §4.9).
//   { joinRequestId } right after someone asks to join with the flat code: alerts the flat admin.
//   { expenseId }     right after a new split is saved: tells everyone with a share (not its creator) what they owe.
//   { handOver }      right after a monthly job is handed over: tells the person who takes it.
//   { choreDone }     right after a chore is marked done: tells every other flatmate.
//   { menuPlanner }   right after "Plan the menu" is handed to someone: tells them.
//   { testMemberId }  "Send a test notification" in Settings: pushes that member's own devices.
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

  const { awayPeriodId, joinRequestId, expenseId, handOver, choreDone, menuPlanner, testMemberId } = (await req.json().catch(() => ({}))) as {
    awayPeriodId?: string;
    joinRequestId?: string;
    expenseId?: string;
    handOver?: { assignmentId: string; fromMemberId: string; always: boolean };
    choreDone?: { assignmentId: string; byMemberId: string };
    menuPlanner?: { toMemberId: string; fromMemberId: string };
    testMemberId?: string;
  };

  if (menuPlanner) {
    const { data: from } = await admin.from("members").select("name").eq("id", menuPlanner.fromMemberId).maybeSingle();
    const result = await sendToMembers(admin, [menuPlanner.toMemberId], {
      title: "You plan the menu now",
      body: `${from?.name ?? "Someone"} handed \u201cPlan the menu\u201d to you. Plan this week's meals in Menu.`,
      url: "/menu",
      tag: "menu-planner",
    });
    return Response.json(result);
  }

  if (choreDone) {
    const { data: turn } = await admin
      .from("chore_assignments")
      .select("flat_id, member_id, due_date, status, chore:chores(name, frequency)")
      .eq("id", choreDone.assignmentId)
      .maybeSingle();
    // Undone again before this ran: nothing to say.
    if (!turn || turn.status !== "done") return Response.json({ sent: 0 });
    const chore = turn.chore as { name?: string; frequency?: string } | null;
    const { data: flatmates } = await admin
      .from("members")
      .select("id, name")
      .eq("flat_id", turn.flat_id)
      .eq("role", "flatmate")
      .is("left_on", null);
    const nameOf = new Map((flatmates ?? []).map((m) => [m.id, m.name as string]));
    const by = nameOf.get(choreDone.byMemberId) ?? "Someone";
    const owner = turn.member_id ? (nameOf.get(turn.member_id) ?? "someone") : null;
    const did = !owner || turn.member_id === choreDone.byMemberId ? `${by} did it` : `${by} marked it done for ${owner}`;
    const when = chore?.frequency === "monthly" ? `, due ${formatRange(turn.due_date, turn.due_date)}` : " today";
    const result = await sendToMembers(
      admin,
      (flatmates ?? []).map((m) => m.id).filter((id) => id !== choreDone.byMemberId),
      {
        title: `${chore?.name ?? "A chore"} done`,
        body: `${did}${when}.`,
        url: "/chores",
        // Done, undone and done again replaces the same notification.
        tag: `done-${choreDone.assignmentId}`,
      },
    );
    return Response.json(result);
  }

  if (testMemberId) {
    const result = await sendToMembers(admin, [testMemberId], {
      title: "Notifications are on",
      body: "This is how Tenant will reach you: duties, splits, rent and leave alerts.",
      url: "/settings",
      tag: "test",
    });
    return Response.json(result);
  }

  if (expenseId) {
    const { data: expense } = await admin
      .from("expenses")
      .select("id, title, total_paise, created_by, paid_by")
      .eq("id", expenseId)
      .maybeSingle();
    if (!expense) return Response.json({ sent: 0 });
    const [{ data: shares }, { data: people }] = await Promise.all([
      admin.from("expense_shares").select("member_id, amount_paise").eq("expense_id", expenseId),
      admin.from("members").select("id, name").in("id", [expense.created_by, expense.paid_by]),
    ]);
    const nameOf = new Map((people ?? []).map((p) => [p.id, p.name as string]));
    const creator = nameOf.get(expense.created_by) ?? "Someone";
    let sent = 0;
    // One personal message each: their own share.
    for (const s of shares ?? []) {
      if (s.member_id === expense.created_by || s.amount_paise <= 0) continue;
      const paidBy = s.member_id === expense.paid_by ? "you paid" : `${nameOf.get(expense.paid_by) ?? "someone"} paid`;
      const r = await sendToMembers(admin, [s.member_id], {
        title: `${creator} added ${expense.title}`,
        body: `Your share ${rupees(s.amount_paise)} of ${rupees(expense.total_paise)} · ${paidBy}`,
        url: `/money/${expense.id}`,
        tag: `expense-${expense.id}`,
      });
      sent += r.sent;
    }
    return Response.json({ sent });
  }

  if (handOver) {
    const { data: turn } = await admin
      .from("chore_assignments")
      .select("member_id, due_date, status, chore:chores(name)")
      .eq("id", handOver.assignmentId)
      .maybeSingle();
    if (!turn?.member_id || turn.status !== "pending" || turn.member_id === handOver.fromMemberId) return Response.json({ sent: 0 });
    const { data: from } = await admin.from("members").select("name").eq("id", handOver.fromMemberId).maybeSingle();
    const name = (turn.chore as { name?: string } | null)?.name ?? "A job";
    const result = await sendToMembers(admin, [turn.member_id], {
      title: handOver.always ? `${name} is yours from now on` : `${name} is yours this time`,
      body: `${from?.name ?? "Someone"} handed it to you. Due ${formatRange(turn.due_date, turn.due_date)}.`,
      url: "/chores",
      tag: `handover-${handOver.assignmentId}`,
    });
    return Response.json(result);
  }

  if (joinRequestId) {
    const { data: request } = await admin
      .from("join_requests")
      .select("flat_id, name, status")
      .eq("id", joinRequestId)
      .maybeSingle();
    if (!request || request.status !== "pending") return Response.json({ sent: 0 });
    const { data: admins } = await admin
      .from("members")
      .select("id")
      .eq("flat_id", request.flat_id)
      .eq("is_admin", true)
      .is("left_on", null);
    const result = await sendToMembers(admin, (admins ?? []).map((m) => m.id), {
      title: `${request.name} wants to join`,
      body: "Accept or decline in Settings.",
      url: "/settings#requests",
      tag: `join-${joinRequestId}`,
    });
    return Response.json(result);
  }

  if (!awayPeriodId) return new Response("Nothing to send", { status: 400 });

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

/** ₹1,234.50 from paise (₹1,234 when there are no paise). */
function rupees(paise: number): string {
  const r = paise / 100;
  return `₹${r.toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
