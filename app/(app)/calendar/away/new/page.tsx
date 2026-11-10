import { requireFlat } from "@/lib/flat";
import { isIsoDate, todayIn } from "@/lib/engine/dates";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { AwayForm } from "../away-form";
import { BackToCalendar, awayFormMembers } from "../shared";

export const metadata = { title: "Mark someone away · Tenant" };

export default async function NewAwayPage({ searchParams }: PageProps<"/calendar/away/new">) {
  const { me, flat } = await requireFlat();
  const { d, member } = await searchParams;
  const today = todayIn(flat.timezone);
  const date = typeof d === "string" && isIsoDate(d) ? d : today;
  const members = await awayFormMembers(flat.id, me);
  // "Mark leave" on the Cook & maid page opens this with the cook or maid picked.
  const staffPick = members.find((m) => m.id === member && m.role !== "flatmate");

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        {staffPick ? (
          <Link
            href="/staff"
            className="-ml-3 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted hover:bg-line/60 hover:text-ink"
          >
            <ChevronLeftIcon size={20} />
            Cook &amp; maid
          </Link>
        ) : (
          <BackToCalendar date={date} />
        )}
        <h1 className="text-display font-extrabold">
          {staffPick ? `Mark ${staffPick.name}’s leave` : me.is_admin ? "Mark someone away" : "Mark away"}
        </h1>
        {me.is_admin || staffPick ? null : (
          <p className="text-muted">You can mark yourself, or the cook&rsquo;s or maid&rsquo;s leave.</p>
        )}
      </header>
      <div className="rounded-[var(--radius-card)] bg-surface p-5 md:p-7">
        <AwayForm
          members={members}
          from={staffPick ? "staff" : undefined}
          initial={{ memberId: staffPick?.id ?? me.id, startDate: date, endDate: date, fullDay: true, slots: [], reason: "" }}
        />
      </div>
    </>
  );
}
