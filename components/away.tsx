import Link from "next/link";
import type { MemberRole } from "@/lib/supabase/types";
import { formatRange, formatShortDate } from "@/lib/engine/calendar";
import { SLOTS, SLOT_LABEL, isLongAway, returnDate, type AwaySlot } from "@/lib/engine/presence";
import { Avatar, cx } from "./ui";
import { ChevronRightIcon } from "./icons";

export const DOT_CLASS: Record<MemberRole, string> = {
  cook: "bg-dot-cook",
  maid: "bg-dot-maid",
  flatmate: "bg-dot-flatmate",
};

export const ROLE_LABEL: Record<MemberRole, string> = { flatmate: "Flatmate", cook: "Cook", maid: "Maid" };

export function RoleDot({ role, className }: { role: MemberRole; className?: string }) {
  return <span className={cx("inline-block size-1.5 rounded-full", DOT_CLASS[role], className)} aria-hidden="true" />;
}

export function Badge({ tone = "accent", children }: { tone?: "accent" | "info" | "warn" | "neutral"; children: React.ReactNode }) {
  const tones = {
    accent: "bg-accent-tint text-accent-dark",
    info: "bg-info-bg text-info-ink",
    warn: "bg-warn-bg text-warn-ink",
    neutral: "bg-bg text-muted",
  };
  return <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", tones[tone])}>{children}</span>;
}

export type AwayItem = {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  full_day: boolean;
  slots: AwaySlot[] | null;
  reason: string | null;
  member: { id: string; name: string; role: MemberRole };
};

/** "Morning and night" for a part-day absence. */
export function partLabel(slots: readonly AwaySlot[] | null | undefined): string {
  const names = SLOTS.filter((s) => !slots?.length || slots.includes(s)).map((s, i) => (i ? SLOT_LABEL[s].toLowerCase() : SLOT_LABEL[s]));
  return names.length === 1 ? `${names[0]} only` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** One row in "Who's away". Tapping it opens the edit form. */
export function AwayRow({ item, today }: { item: AwayItem; today: string }) {
  const { member } = item;
  const long = isLongAway(item);
  const staff = member.role !== "flatmate";
  const back = returnDate(item);
  // "Back" only means something after a full-day absence.
  const ongoing = item.full_day && item.start_date <= today && today <= item.end_date;

  const detail = [
    staff ? ROLE_LABEL[member.role] : null,
    item.full_day ? null : partLabel(item.slots),
    item.reason,
  ].filter(Boolean);

  return (
    <li>
      <Link
        href={`/calendar/away/${item.id}`}
        className="flex min-h-16 items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-bg"
        aria-label={`Edit ${member.name}, away ${formatRange(item.start_date, item.end_date)}`}
      >
        <span className="relative">
          <Avatar name={member.name} size={40} away />
          <RoleDot role={member.role} className="absolute -right-0.5 -bottom-0.5 size-3 ring-2 ring-surface" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold">{member.name}</span>
            {long ? <Badge tone="info">Long away</Badge> : null}
          </span>
          <span className="text-sm font-semibold text-ink">{formatRange(item.start_date, item.end_date)}</span>
          {detail.length ? <span className="truncate text-sm text-muted">{detail.join(", ")}</span> : null}
          {ongoing ? <span className="text-sm text-muted">Back {formatShortDate(back)}</span> : null}
        </span>
        <ChevronRightIcon size={20} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
