import { requireFlat } from "@/lib/flat";
import { isIsoDate, todayIn } from "@/lib/engine/dates";
import { AwayForm } from "../away-form";
import { BackToCalendar, awayFormMembers } from "../shared";

export const metadata = { title: "Mark someone away · Tenant" };

export default async function NewAwayPage({ searchParams }: PageProps<"/calendar/away/new">) {
  const { me, flat } = await requireFlat();
  const { d } = await searchParams;
  const today = todayIn(flat.timezone);
  const date = typeof d === "string" && isIsoDate(d) ? d : today;
  const members = await awayFormMembers(flat.id, me);

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <BackToCalendar date={date} />
        <h1 className="text-display font-extrabold">{me.is_admin ? "Mark someone away" : "Mark away"}</h1>
        {me.is_admin ? null : (
          <p className="text-muted">You can mark yourself, or the cook&rsquo;s or maid&rsquo;s leave.</p>
        )}
      </header>
      <div className="rounded-[var(--radius-card)] bg-surface p-5 md:p-7">
        <AwayForm
          members={members}
          initial={{ memberId: me.id, startDate: date, endDate: date, fullDay: true, slots: [], reason: "" }}
        />
      </div>
    </>
  );
}
