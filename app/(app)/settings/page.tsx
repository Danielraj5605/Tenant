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
import { FlatCode } from "./flat-code";
import { SignOutButton } from "./sign-out";
import { AddStaffForm, JoinRequestItem, MenuOwnerForm } from "./member-forms";
import { formatFlatCode } from "@/lib/engine/onboarding";
import { PushSetup } from "@/components/push-setup";
import { PasswordSetup } from "@/components/password-setup";
import { CategoryRules } from "./category-rules";

export const metadata = { title: "Flat settings · Tenant" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { me, flat, user } = await requireFlat();
  const { created, removed, request } = await searchParams;
  const today = todayIn(flat.timezone);
  const supabase = await createClient();
  const [{ data: members }, { data: periods }, { data: categories }, { data: requests }] = await Promise.all([
    supabase
      .from("members")
      .select("*")
      .eq("flat_id", flat.id)
      .or(`left_on.is.null,left_on.gte.${today}`)
      .order("sort_order"),
    supabase.from("away_periods").select("*").eq("flat_id", flat.id).lte("start_date", today).gte("end_date", today),
    supabase.from("expense_categories").select("id, name, default_rule").eq("flat_id", flat.id).order("created_at"),
    me.is_admin
      ? supabase
          .from("join_requests")
          .select("id, name, created_at, user:app_users(username)")
          .eq("flat_id", flat.id)
          .eq("status", "pending")
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const pending = (requests ?? []) as { id: string; name: string; created_at: string; user: { username: string } | null }[];
  const askedOn = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", { timeZone: flat.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

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
        {created ? <Notice tone="success">Your flat is ready. Send the flat code to your flatmates.</Notice> : null}
        {request === "accepted" ? (
          <Notice tone="success">Accepted. They&rsquo;re in the flat now.</Notice>
        ) : request === "declined" ? (
          <Notice tone="success">Request declined.</Notice>
        ) : null}
        {removed === "left" ? (
          <Notice tone="success">Removed. Their past bills and history are kept.</Notice>
        ) : removed === "deleted" ? (
          <Notice tone="success">Removed. They had no history, so nothing else changed.</Notice>
        ) : null}

        {me.is_admin && pending.length ? (
          <Card className="flex flex-col gap-1">
            <h2 id="requests" className="scroll-mt-6 text-title font-bold">
              {pending.length === 1 ? "1 person wants to join" : `${pending.length} people want to join`}
            </h2>
            <p className="text-sm text-muted">Accept only people you know. They&rsquo;ll see the flat&rsquo;s chores, menu and money.</p>
            <ul className="flex flex-col">
              {pending.map((r) => (
                <JoinRequestItem key={r.id} id={r.id} name={r.name} username={r.user?.username ?? "unknown"} when={askedOn(r.created_at)} />
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="flex flex-col gap-2 px-3">
          <div className="flex items-baseline justify-between px-2">
            <h2 className="text-title font-bold">Members</h2>
            <p className="text-sm font-semibold text-muted">
              {flatmates.length} {flatmates.length === 1 ? "flatmate" : "flatmates"}
            </p>
          </div>
          <ul className="flex flex-col">
            {sorted.map((m) => {
              // Out for a meal or two still counts as home.
              const away = awayToday.find((p) => p.member_id === m.id && p.full_day);
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
                <h2 id="add-flatmate" className="scroll-mt-6 text-title font-bold">Add a flatmate</h2>
                <p className="text-sm text-muted">
                  They sign up at {siteUrl.replace(/^https?:\/\//, "")} and enter this code. You&rsquo;ll see their
                  request here to accept or decline.
                </p>
              </div>
              <FlatCode code={flat.flat_code} shown={formatFlatCode(flat.flat_code)} flatName={flat.name} siteUrl={siteUrl} />
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 id="add-staff" className="scroll-mt-6 text-title font-bold">Add the cook or maid</h2>
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
          <PasswordSetup username={user.username} />
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
