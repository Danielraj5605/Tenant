import Link from "next/link";
import { Avatar, Card } from "@/components/ui";
import { MenuPlannerButton } from "@/components/menu-chore";
import { AlertIcon, ChevronRightIcon } from "@/components/icons";

/**
 * "Plan the menu" as a chore with one person: whoever has it plans breakfast,
 * lunch and dinner. They (or the admin) can hand it over; when nobody has it,
 * any flatmate can choose who does.
 */
export function MenuChoreCard({
  me,
  ownerId,
  ownerName,
  ownerLeft,
  flatmates,
  weekPlanned,
}: {
  me: { id: string; is_admin: boolean };
  ownerId: string | null;
  ownerName: string | null;
  ownerLeft: boolean;
  flatmates: { id: string; name: string }[];
  /** Days of this week with any dish planned, out of 7. */
  weekPlanned: number;
}) {
  const vacant = !ownerId || ownerLeft;
  const mine = ownerId === me.id && !ownerLeft;
  const canChange = vacant || mine || me.is_admin;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-title font-bold">Plan the menu</h3>
          <p className="text-sm text-muted">Breakfast, lunch and dinner for the week. One person, until they hand it over.</p>
        </div>
        <Link
          href="/menu"
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
        >
          Menu
          <ChevronRightIcon size={16} />
        </Link>
      </div>

      {vacant ? (
        <p className="flex gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm font-semibold text-warn-ink">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          {ownerLeft && ownerName
            ? `${ownerName} has left the flat. Choose who plans the menu now.`
            : "Nobody plans the menu yet, so only the admin can. Choose who does it."}
        </p>
      ) : (
        <div className={mine ? "flex min-h-14 items-center gap-3 rounded-xl bg-surface px-3 py-2 ring-2 ring-accent ring-inset" : "flex min-h-14 items-center gap-3 rounded-xl bg-sunk px-3 py-2"}>
          <Avatar name={ownerName ?? "?"} size={36} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-semibold text-muted">This week: {weekPlanned} of 7 days planned</span>
            <span className="name-wrap font-bold">{mine ? "You" : ownerName}</span>
          </span>
        </div>
      )}

      {canChange ? (
        <MenuPlannerButton
          currentId={vacant ? null : ownerId}
          flatmates={flatmates}
          meId={me.id}
          label={vacant ? "Choose who plans" : mine ? "Hand over" : "Change who plans"}
        />
      ) : null}
    </Card>
  );
}
