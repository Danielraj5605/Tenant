import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { todayIn } from "@/lib/engine/dates";
import { formatShortDate } from "@/lib/engine/calendar";
import { awayOn, isLongAway } from "@/lib/engine/presence";
import { Avatar, Card, Notice } from "@/components/ui";
import { Badge, ROLE_LABEL } from "@/components/away";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { InviteLink } from "./invite-link";
import { SignOutButton } from "./sign-out";
import { AddStaffForm, MenuOwnerForm } from "./member-forms";
import { PushSetup } from "@/components/push-setup";
import { PasswordSetup } from "@/components/password-setup";
import { USERNAME_DOMAIN } from "@/lib/engine/onboarding";
import { CategoryRules } from "./category-rules";

export const metadata = { title: "Flat settings · Tenant" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { me, flat, email } = await requireFlat();
  const { created } = await searchParams;
  const signInName = email?.endsWith(`@${USERNAME_DOMAIN}`) ? email.split("@")[0] : (email ?? "your account");
  const today = todayIn(flat.timezone);
  const supabase = await createClient();
  const [{ data: members }, { data: periods }, { data: categories }] = await Promise.all([
    supabase
      .from("members")
      .select("*")
      .eq("flat_id", flat.id)
      .or(`left_on.is.null,left_on.gte.${today}`)
      .order("sort_order"),
    supabase.from("away_periods").select("*").eq("flat_id", flat.id).lte("start_date", today).gte("end_date", today),
    supabase.from("expense_categories").select("id, name, default_rule").eq("flat_id", flat.id).order("created_at"),
  ]);

  const people = members ?? [];
  const awayToday = awayOn(today, periods ?? []);
  const flatmates = people.filter((m) => m.role === "flatmate");
  const order = { flatmate: 0, cook: 1, maid: 2 } as const;
  const sorted = [...people].sort((a, b) => order[a.role] - order[b.role] || a.sort_order - b.sort_order);

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

        <Card className="flex flex-col gap-2 px-3">
          <div className="flex items-baseline justify-between px-2">
            <h2 className="text-title font-bold">Members</h2>
            <p className="text-sm font-semibold text-muted">
              {flatmates.length} {flatmates.length === 1 ? "flatmate" : "flatmates"}
            </p>
          </div>
          <ul className="flex flex-col">
            {sorted.map((m) => {
              const away = awayToday.find((p) => p.member_id === m.id);
              const badges = (
                <span className="flex flex-wrap justify-end gap-1.5">
                  {m.is_admin ? <Badge>Admin</Badge> : null}
                  {flat.menu_owner_id === m.id ? <Badge>Menu owner</Badge> : null}
                  {away && isLongAway(away) ? <Badge tone="info">Long away</Badge> : null}
                  {m.left_on ? <Badge tone="neutral">Leaves {formatShortDate(m.left_on)}</Badge> : null}
                </span>
              );
              const body = (
                <>
                  <Avatar name={m.name} size={40} away={Boolean(away)} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">
                      {m.name}
                      {m.id === me.id ? <span className="font-medium text-muted"> (you)</span> : null}
                    </span>
                    <span className="text-sm text-muted">
                      {ROLE_LABEL[m.role]}
                      {m.role !== "flatmate" ? ", no login" : null}
                    </span>
                  </span>
                  {badges}
                </>
              );
              return (
                <li key={m.id} className="border-b border-line last:border-b-0">
                  {me.is_admin ? (
                    <Link
                      href={`/settings/members/${m.id}`}
                      className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg"
                      aria-label={`Edit ${m.name}`}
                    >
                      {body}
                      <ChevronRightIcon size={20} className="shrink-0 text-muted" />
                    </Link>
                  ) : (
                    <div className="flex min-h-16 items-center gap-3 px-2 py-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {me.is_admin ? (
          <>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-title font-bold">Add a flatmate</h2>
                <p className="text-sm text-muted">
                  Send this link. Anyone who opens it can sign in and join {flat.name}, so share it only with
                  flatmates.
                </p>
              </div>
              <InviteLink url={`${siteUrl}/join/${flat.invite_code}`} flatName={flat.name} />
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-title font-bold">Add the cook or maid</h2>
                <p className="text-sm text-muted">
                  They don&rsquo;t sign in. Any flatmate can mark their leave on the calendar.
                </p>
              </div>
              <AddStaffForm />
            </Card>

            <Card className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <h2 className="text-title font-bold">Default splits</h2>
                <p className="text-sm text-muted">
                  Who shares each kind of cost by default. You can always change people and amounts on a split.
                </p>
              </div>
              <CategoryRules categories={categories ?? []} />
            </Card>

            <Card className="flex flex-col gap-3">
              <h2 className="text-title font-bold">Menu owner</h2>
              <MenuOwnerForm flatmates={flatmates.map(({ id, name }) => ({ id, name }))} current={flat.menu_owner_id} />
            </Card>
          </>
        ) : null}

        <Card className="flex flex-col gap-3">
          <h2 className="text-title font-bold">Password</h2>
          <PasswordSetup signInName={signInName} />
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-title font-bold">Reminders on this phone</h2>
          <PushSetup />
        </Card>

        <SignOutButton />
      </div>
    </>
  );
}
