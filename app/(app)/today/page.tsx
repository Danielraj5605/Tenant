import Link from "next/link";
import { requireFlat } from "@/lib/flat";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, greetingFor, hourIn, todayIn } from "@/lib/engine/dates";
import { Avatar, Card } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";

export const metadata = { title: "Today · Tenant" };

export default async function TodayPage() {
  const { me, flat } = await requireFlat();
  const supabase = await createClient();
  const { data: flatmates } = await supabase
    .from("members")
    .select("id, name")
    .eq("flat_id", flat.id)
    .eq("role", "flatmate")
    .is("left_on", null)
    .order("sort_order");

  const now = new Date();
  const today = todayIn(flat.timezone, now);
  const people = flatmates ?? [];

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-muted">{formatLongDate(today)}</p>
          <h1 className="text-display font-extrabold">
            {greetingFor(hourIn(flat.timezone, now))}, {me.name}
          </h1>
        </div>
        <Link
          href="/settings"
          aria-label="Flat settings"
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:ring-2 hover:ring-line-strong"
        >
          <Avatar name={me.name} size={44} />
        </Link>
      </header>

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-title font-bold">{flat.name}</h2>
          <p className="text-sm font-semibold text-muted">
            {people.length} {people.length === 1 ? "flatmate" : "flatmates"}
          </p>
        </div>
        <ul className="flex flex-wrap gap-3">
          {people.map((p) => (
            <li key={p.id} className="flex flex-col items-center gap-1">
              <Avatar name={p.name} size={44} />
              <span className="max-w-14 truncate text-xs font-semibold">{p.name}</span>
            </li>
          ))}
        </ul>
        {me.is_admin ? (
          <Link
            href="/settings"
            className="-mx-2 flex min-h-11 items-center justify-between rounded-xl px-2 font-bold text-accent hover:bg-accent-tint"
          >
            Invite flatmates
            <ChevronRightIcon size={20} />
          </Link>
        ) : null}
      </Card>
    </>
  );
}
