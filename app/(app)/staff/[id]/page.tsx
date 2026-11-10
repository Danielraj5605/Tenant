import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/components/away";
import { ChevronLeftIcon } from "@/components/icons";
import { RemoveMemberButton } from "../../settings/member-forms";
import { EditStaffForm } from "../forms";

export const metadata = { title: "Edit cook or maid · Tenant" };

export default async function EditStaffPage({ params }: PageProps<"/staff/[id]">) {
  const { me, flat } = await requireFlat();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("members")
    .select("id, name, role, phone, joined_on, left_on")
    .eq("id", id)
    .eq("flat_id", flat.id)
    .neq("role", "flatmate")
    .maybeSingle();
  if (!person || person.role === "flatmate") notFound();

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href="/staff"
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          Cook &amp; maid
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-display font-extrabold break-words">{person.name}</h1>
          <p className="font-medium text-muted">{ROLE_LABEL[person.role]}, no login</p>
        </div>
      </header>
      <div className="rounded-[var(--radius-card)] bg-surface p-5 md:p-7">
        <EditStaffForm member={{ ...person, role: person.role }} />
      </div>
      {me.is_admin ? (
        <div className="mt-6">
          <RemoveMemberButton memberId={person.id} name={person.name} hasLogin={false} />
        </div>
      ) : null}
    </>
  );
}
