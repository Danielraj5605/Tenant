import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { AwayForm } from "../away-form";
import { BackToCalendar, awayFormMembers } from "../shared";
import { DeleteAwayButton } from "./delete-button";

export const metadata = { title: "Edit away dates · Tenant" };

export default async function EditAwayPage({ params }: PageProps<"/calendar/away/[id]">) {
  const { flat } = await requireFlat();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: period }, members] = await Promise.all([
    supabase.from("away_periods").select("*").eq("id", id).eq("flat_id", flat.id).maybeSingle(),
    awayFormMembers(flat.id),
  ]);
  if (!period) notFound();

  // Keep the form usable if the member has since left the flat.
  const options = members.some((m) => m.id === period.member_id)
    ? members
    : [
        ...members,
        ...((await supabase.from("members").select("id, name, role").eq("id", period.member_id)).data ?? []),
      ];

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <BackToCalendar date={period.start_date} />
        <h1 className="text-display font-extrabold">Edit away dates</h1>
      </header>
      <AwayForm
        members={options}
        initial={{
          id: period.id,
          memberId: period.member_id,
          startDate: period.start_date,
          endDate: period.end_date,
          fullDay: period.full_day,
          reason: period.reason ?? "",
        }}
      />
      <div className="mt-3">
        <DeleteAwayButton id={period.id} back={period.start_date} />
      </div>
    </>
  );
}
