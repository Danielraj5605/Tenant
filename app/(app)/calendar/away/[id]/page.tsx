import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { AwayForm } from "../away-form";
import { BackToCalendar, awayFormMembers } from "../shared";
import { DeleteAwayButton } from "./delete-button";
import { canEditAwayFor } from "@/lib/engine/permissions";
import { formatRange } from "@/lib/engine/calendar";
import { partLabel } from "@/components/away";
import { Card } from "@/components/ui";

export const metadata = { title: "Edit away dates · Tenant" };

export default async function EditAwayPage({ params }: PageProps<"/calendar/away/[id]">) {
  const { flat, me } = await requireFlat();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: period }, members] = await Promise.all([
    supabase.from("away_periods").select("*").eq("id", id).eq("flat_id", flat.id).maybeSingle(),
    awayFormMembers(flat.id, me),
  ]);
  if (!period) notFound();

  const { data: owner } = await supabase
    .from("members")
    .select("id, name, role")
    .eq("id", period.member_id)
    .eq("flat_id", flat.id)
    .maybeSingle();
  if (!owner) notFound();

  // Someone else's away days: show them, but only they or the admin can change them.
  if (!canEditAwayFor(me, owner)) {
    return (
      <>
        <header className="mb-6 flex flex-col gap-3">
          <BackToCalendar date={period.start_date} />
          <h1 className="text-display font-extrabold break-words">{owner.name} is away</h1>
        </header>
        <Card className="flex flex-col gap-2">
          <p className="text-lg font-bold">{formatRange(period.start_date, period.end_date)}</p>
          {period.full_day ? null : <p className="text-muted">{partLabel(period.slots)}</p>}
          {period.reason ? <p className="text-muted">{period.reason}</p> : null}
          <p className="mt-2 text-sm text-muted">Only {owner.name} or the flat admin can change these dates.</p>
        </Card>
      </>
    );
  }

  // Keep the form usable if the member has since left the flat.
  const options = members.some((m) => m.id === owner.id) ? members : [...members, owner];

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <BackToCalendar date={period.start_date} />
        <h1 className="text-display font-extrabold">Edit away dates</h1>
      </header>
      <div className="rounded-[var(--radius-card)] bg-surface p-5 md:p-7">
        <AwayForm
          members={options}
          initial={{
            id: period.id,
            memberId: period.member_id,
            startDate: period.start_date,
            endDate: period.end_date,
            fullDay: period.full_day,
            slots: period.slots ?? [],
            reason: period.reason ?? "",
          }}
        />
      </div>
      <div className="mt-3">
        <DeleteAwayButton id={period.id} back={period.start_date} />
      </div>
    </>
  );
}
