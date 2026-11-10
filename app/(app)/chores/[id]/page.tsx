import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { todayIn } from "@/lib/engine/dates";
import { createClient } from "@/lib/supabase/server";
import { ChoreForm } from "../chore-form";
import { BackToChores, rotationCandidates } from "../shared";
import { DeleteChoreButton } from "./delete-chore";

export const metadata = { title: "Edit chore · Tenant" };

export default async function EditChorePage({ params }: PageProps<"/chores/[id]">) {
  const { me, flat } = await requireFlat();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const [{ data: chore }, { data: rotation }, flatmates] = await Promise.all([
    supabase.from("chores").select("*").eq("id", id).eq("flat_id", flat.id).maybeSingle(),
    supabase.from("chore_rotation").select("member_id").eq("chore_id", id).eq("flat_id", flat.id).order("position"),
    rotationCandidates(flat.id),
  ]);
  if (!chore) notFound();

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <BackToChores />
        <h1 className="text-display font-extrabold break-words">{chore.name}</h1>
      </header>
      <div className="rounded-[var(--radius-card)] bg-surface p-5 md:p-7">
        <ChoreForm
          flatmates={flatmates}
          today={todayIn(flat.timezone)}
          meId={me.id}
          initial={{
            id: chore.id,
            name: chore.name,
            frequency: chore.frequency,
            days: chore.days_of_week,
            dueTime: chore.due_time?.slice(0, 5) ?? "",
            rotation: (rotation ?? []).map((r) => r.member_id).filter((m) => flatmates.some((f) => f.id === m)),
            everyMonths: chore.every_months ?? undefined,
            dayOfMonth: chore.day_of_month ?? undefined,
            startMonth: chore.start_month?.slice(0, 7),
          }}
        />
      </div>
      <div className="mt-3">
        <DeleteChoreButton id={chore.id} />
      </div>
    </>
  );
}
