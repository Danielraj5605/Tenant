import Link from "next/link";
import type { MonthlyView } from "@/lib/chores";
import { canMarkDuty } from "@/lib/engine/permissions";
import { formatShortDate } from "@/lib/engine/calendar";
import { monthlyLabel, monthlyStatus } from "@/lib/engine/monthly";
import { Avatar, Card, Pill, cx } from "@/components/ui";
import { DutyButton } from "@/components/chore-duty";
import { HandOverButton } from "@/components/hand-over";
import { AlertIcon, CheckIcon, PencilIcon } from "@/components/icons";

type Me = { id: string; is_admin: boolean };

/** One monthly chore: this cycle's turn (and any overdue ones), who does it, and when it's next due. */
export function MonthlyCard({
  view,
  me,
  today,
  nameOf,
  flatmates,
}: {
  view: MonthlyView;
  me: Me;
  today: string;
  nameOf: Map<string, string>;
  flatmates: { id: string; name: string }[];
}) {
  const { chore, turns, ownerId, nextDue, awayOnDue, ownerLeft, leftTurns, leftNames } = view;
  const who = (id: string | null) =>
    id === me.id ? "You" : id ? (nameOf.get(id) ?? leftNames.get(id) ?? "Former member") : "Nobody";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-title font-bold">{chore.name}</h3>
          <p className="text-sm text-muted">{monthlyLabel(chore)}</p>
        </div>
        <Link
          href={`/chores/${chore.id}`}
          aria-label={`Edit ${chore.name}`}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm font-bold text-accent-dark hover:border-accent hover:bg-accent-tint"
        >
          <PencilIcon size={15} />
          Edit
        </Link>
      </div>

      {ownerLeft ? (
        <p className="flex gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm font-semibold text-warn-ink">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          <span>
            {who(ownerId)} has left the flat.{" "}
            <Link href={`/chores/${chore.id}`} className="underline underline-offset-2">
              Edit this job
            </Link>{" "}
            to choose who does it now.
          </span>
        </p>
      ) : null}

      {turns.length === 0 ? (
        <div className="flex min-h-14 items-center gap-3 rounded-xl bg-sunk px-3 py-2">
          {ownerId ? <Avatar name={nameOf.get(ownerId) ?? "?"} size={36} /> : null}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-semibold text-muted">First one due {formatShortDate(nextDue)}</span>
            <span className="name-wrap font-bold">{who(ownerId)}</span>
          </span>
        </div>
      ) : (
        turns.map((turn) => {
          const status = monthlyStatus(turn.due_date, turn.status === "done", today);
          const mine = turn.member_id === me.id;
          const pendingMine = mine && turn.status === "pending";
          const canAct = canMarkDuty(me, turn);
          // Their person has left: anyone can pass the turn on.
          const orphaned = leftTurns.has(turn.id);
          return (
            <div key={turn.id} className="flex flex-col gap-3">
              <div
                className={cx(
                  "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2",
                  status.kind === "overdue"
                    ? "bg-warn-bg"
                    : pendingMine
                      ? "bg-surface ring-2 ring-accent ring-inset"
                      : "bg-sunk",
                )}
              >
                <Avatar name={who(turn.member_id)} size={36} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cx("text-xs font-semibold", status.kind === "overdue" ? "text-warn-ink" : "text-muted")}>
                    {status.kind === "overdue"
                      ? `Overdue since ${formatShortDate(turn.due_date)}`
                      : status.kind === "due"
                        ? status.daysLeft === 0
                          ? "Due today"
                          : `Due ${formatShortDate(turn.due_date)}`
                        : `Due ${formatShortDate(turn.due_date)}`}
                  </span>
                  <span className="name-wrap font-bold">{who(turn.member_id)}</span>
                </span>
                {status.kind === "done" ? (
                  <Pill>
                    <CheckIcon size={14} strokeWidth={2.5} /> Done
                  </Pill>
                ) : (
                  <Pill tone={pendingMine ? "accent" : "neutral"}>To do</Pill>
                )}
              </div>

              {awayOnDue.has(turn.id) ? (
                <p className="flex gap-2 rounded-xl bg-info-bg px-3 py-2 text-sm font-semibold text-info-ink">
                  <AlertIcon size={18} className="mt-0.5 shrink-0" />
                  {mine ? "You're" : `${who(turn.member_id)} is`} away on {formatShortDate(turn.due_date)}. Hand it over to someone at
                  home?
                </p>
              ) : null}

              {orphaned && !canAct ? (
                <HandOverButton
                  assignmentId={turn.id}
                  choreName={chore.name}
                  currentId={turn.member_id}
                  flatmates={flatmates}
                  meId={me.id}
                />
              ) : null}

              {canAct ? (
                <div className="flex flex-col gap-3">
                  <DutyButton
                    assignmentId={turn.id}
                    done={turn.status === "done"}
                    forName={mine ? undefined : nameOf.get(turn.member_id ?? "")}
                  />
                  {turn.status === "pending" ? (
                    <HandOverButton
                      assignmentId={turn.id}
                      choreName={chore.name}
                      currentId={turn.member_id}
                      flatmates={flatmates}
                      meId={me.id}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      {turns.length ? (
        <p className="text-sm text-muted">
          Next: <span className="font-semibold text-ink">{formatShortDate(nextDue)}</span>, {who(ownerId).replace(/^You$/, "you")}
        </p>
      ) : null}
    </Card>
  );
}
