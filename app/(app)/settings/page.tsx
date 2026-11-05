import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { Avatar, Card, Notice } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";
import { InviteLink } from "./invite-link";
import { SignOutButton } from "./sign-out";

export const metadata = { title: "Flat settings · Tenant" };

const ROLE_LABEL = { flatmate: "Flatmate", cook: "Cook", maid: "Maid" } as const;

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { me, flat } = await requireFlat();
  const { created } = await searchParams;
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id, name, role, is_admin, user_id")
    .eq("flat_id", flat.id)
    .is("left_on", null)
    .order("sort_order");

  const people = members ?? [];
  const flatmateCount = people.filter((m) => m.role === "flatmate").length;

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href="/today"
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
        >
          <ChevronLeftIcon size={20} />
          Today
        </Link>
        <h1 className="text-display font-extrabold break-words">{flat.name}</h1>
      </header>

      <div className="flex flex-col gap-4">
        {created ? <Notice tone="success">Your flat is ready. Send the invite link to your flatmates.</Notice> : null}

        {me.is_admin ? (
          <Card className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-title font-bold">Invite flatmates</h2>
              <p className="text-sm text-muted">
                Anyone with this link can sign in and join {flat.name}. Share it only with your flatmates.
              </p>
            </div>
            <InviteLink url={`${siteUrl}/join/${flat.invite_code}`} flatName={flat.name} />
          </Card>
        ) : null}

        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-title font-bold">Members</h2>
            <p className="text-sm font-semibold text-muted">
              {flatmateCount} {flatmateCount === 1 ? "flatmate" : "flatmates"}
            </p>
          </div>
          <ul className="-mx-1 flex flex-col">
            {people.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center gap-3 border-b border-line px-1 last:border-b-0">
                <Avatar name={m.name} size={40} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {m.name}
                    {m.id === me.id ? <span className="font-medium text-muted"> (you)</span> : null}
                  </span>
                  <span className="text-sm text-muted">{ROLE_LABEL[m.role]}</span>
                </div>
                {m.is_admin ? (
                  <span className="rounded-full bg-accent-tint px-2.5 py-1 text-xs font-bold text-accent-dark">
                    Admin
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <SignOutButton />
      </div>
    </>
  );
}
