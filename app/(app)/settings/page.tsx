import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";
import { todayIn } from "@/lib/engine/dates";
import { formatShortDate } from "@/lib/engine/calendar";
import { awayOn, isLongAway } from "@/lib/engine/presence";
import { Avatar, Card, Notice, Pill, SectionHeading } from "@/components/ui";
import { Badge, ROLE_LABEL } from "@/components/away";
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "@/components/icons";
import { FlatCode } from "./flat-code";
import { SignOutButton } from "./sign-out";
import { JoinRequestItem, UsualSkipsForm } from "./member-forms";
import { formatFlatCode } from "@/lib/engine/onboarding";
import { PushSetup } from "@/components/push-setup";
import { PasswordSetup } from "@/components/password-setup";

export const metadata = { title: "Flat settings · Tenant" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { me, flat, user } = await requireFlat();
  const { created, removed, request, admin } = await searchParams;
  const today = todayIn(flat.timezone);
  const supabase = await createClient();
  const [{ data: members }, { data: periods }, { data: requests }] = await Promise.all([
    supabase
      .from("members")
      .select("*")
      .eq("flat_id", flat.id)
      .or(`left_on.is.null,left_on.gte.${today}`)
      .order("sort_order"),
    supabase.from("away_periods").select("*").eq("flat_id", flat.id).lte("start_date", today).gte("end_date", today),
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
  // The cook and maid have their own page (/staff).
  const sorted = flatmates;
  const staff = people.filter((m) => m.role !== "flatmate" && (!m.left_on || m.left_on >= today));

  return (
    <div data-wide>
      <header className="mb-6 flex flex-col gap-3">
        <Link
          href="/today"
          className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink lg:hidden"
        >
          <ChevronLeftIcon size={20} />
          Today
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-display font-extrabold break-words lg:text-display-lg">{flat.name}</h1>
          <p className="font-medium text-muted">
            Flat settings{me.is_admin ? " · you’re the admin" : ""}
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-col gap-3 empty:hidden">
        {created ? <Notice tone="success">Your flat is ready. Send the flat code to your flatmates.</Notice> : null}
        {admin === "handed" ? <Notice tone="success">Done. You&rsquo;re a regular flatmate now.</Notice> : null}
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
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
            <div className="px-2">
              <SectionHeading
                title="Members"
                meta={
                  <Pill tone="neutral">
                    {flatmates.length} {flatmates.length === 1 ? "flatmate" : "flatmates"}
                  </Pill>
                }
              />
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
                      <span className="text-sm text-muted">{ROLE_LABEL[m.role]}</span>
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

          <Link
            href="/staff"
            className="group flex min-h-20 items-center gap-3 rounded-[var(--radius-card)] bg-surface px-5 py-4 transition-shadow hover:ring-2 hover:ring-line-strong"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-dark">
              <UsersIcon size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">Cook &amp; maid</span>
              <span className="truncate text-sm text-muted">
                {staff.length ? staff.map((s) => `${s.name} (${ROLE_LABEL[s.role].toLowerCase()})`).join(", ") : "Add them, with their phone numbers"}
              </span>
            </span>
            <ChevronRightIcon size={20} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
          </Link>

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

            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {me.is_admin ? (
            <>
              <h2 className="mt-2 px-1 text-sm font-bold tracking-wide text-muted uppercase first:mt-0">How the flat runs</h2>
              <Link
                href="/chores"
                className="group flex min-h-20 items-center gap-3 rounded-[var(--radius-card)] bg-surface px-5 py-4 transition-shadow hover:ring-2 hover:ring-line-strong"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold">Who plans the menu</span>
                  <span className="text-sm text-muted">
                    {flatmates.find((f) => f.id === flat.menu_owner_id)?.name ?? "Nobody yet"} · it&rsquo;s a chore now: hand it
                    over or choose someone on Chores
                  </span>
                </span>
                <ChevronRightIcon size={20} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          ) : null}

          <h2 className="mt-2 px-1 text-sm font-bold tracking-wide text-muted uppercase first:mt-0">You</h2>
          <Card className="flex flex-col gap-3">
            <h2 className="text-title font-bold">My meals</h2>
            <UsualSkipsForm current={me.usual_skips ?? []} />
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-title font-bold">Password</h2>
            <PasswordSetup username={user.username} />
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-title font-bold">Notifications on this device</h2>
            <PushSetup />
          </Card>

          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
