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
  const members = await awayFormMembers(flat.id);

  return (
    <>
      <header className="mb-6 flex flex-col gap-3">
        <BackToCalendar date={date} />
        <h1 className="text-display font-extrabold">Mark someone away</h1>
      </header>
      <AwayForm
        members={members}
        initial={{ memberId: me.id, startDate: date, endDate: date, fullDay: true, slots: [], reason: "" }}
      />
    </>
  );
}
