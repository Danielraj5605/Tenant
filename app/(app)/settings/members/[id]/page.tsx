import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/components/away";
import { ChevronLeftIcon } from "@/components/icons";
import { EditMemberForm, RemoveMemberButton } from "../../member-forms";
import { ResetPasswordForm } from "@/components/password-setup";
import { Card } from "@/components/ui";

export const metadata = { title: "Edit member · Tenant" };

export default async function EditMemberPage({ params }: PageProps<"/settings/members/[id]">) {
  const { me, flat } = await requireFlat();
  if (!me.is_admin) redirect("/settings");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, name, role, joined_on, left_on, user_id")
    .eq("id", id)
    .eq("flat_id", flat.id)
    .maybeSingle();
  if (!member) notFound();

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href="/settings"
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          Settings
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-display font-extrabold break-words">{member.name}</h1>
          <p className="font-medium text-muted">
            {ROLE_LABEL[member.role]}
            {member.user_id ? "" : ", no login"}
          </p>
        </div>
      </header>
      <EditMemberForm member={member} />
      {member.user_id && member.id !== me.id ? (
        <Card className="mt-6 flex flex-col gap-3">
          <h2 className="text-title font-bold">Forgot their password?</h2>
          <ResetPasswordForm memberId={member.id} name={member.name} />
        </Card>
      ) : null}
      {member.id !== me.id ? (
        <div className="mt-6">
          <RemoveMemberButton memberId={member.id} name={member.name} hasLogin={Boolean(member.user_id)} />
        </div>
      ) : null}
    </>
  );
}
