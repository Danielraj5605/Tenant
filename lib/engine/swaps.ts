/**
 * Swapping chore days within a rotation: which turns can be swapped, and
 * whether a swap still holds when it's accepted.
 * Pure functions over plain data; no database access.
 */

/** A day of a chore and who does it. */
export type Turn = { date: string; memberId: string | null };

/** Today's turn (if still to do) and the coming days, in date order. */
export function openTurns(
  today: string,
  todayTurn: { member_id: string | null; status: string } | null,
  upcoming: readonly Turn[],
): Turn[] {
  const first = todayTurn && todayTurn.status === "pending" && todayTurn.member_id ? [{ date: today, memberId: todayTurn.member_id }] : [];
  return [...first, ...upcoming.filter((t) => t.memberId)];
}

export type SwapInput = {
  turns: readonly Turn[];
  fromMember: string;
  fromDate: string;
  toMember: string;
  toDate: string;
  today: string;
  /** Is this person home (not away for the whole day) on this date? */
  isHome: (memberId: string, date: string) => boolean;
};

/** Why this swap can't happen, or null when it can. */
export function swapProblem(s: SwapInput): string | null {
  if (s.fromMember === s.toMember) return "Pick someone else's day.";
  if (s.fromDate === s.toDate) return "Pick two different days.";
  if (s.fromDate < s.today || s.toDate < s.today) return "One of these days has passed.";
  const on = (date: string) => s.turns.find((t) => t.date === date)?.memberId ?? null;
  if (on(s.fromDate) !== s.fromMember) return "That day isn't your turn any more.";
  if (on(s.toDate) !== s.toMember) return "That day isn't their turn any more.";
  if (!s.isHome(s.toMember, s.fromDate)) return "They're away on your day.";
  if (!s.isHome(s.fromMember, s.toDate)) return "You're away on their day.";
  return null;
}

/** A request is only good while both days are still ahead. */
export const swapExpired = (swap: { from_date: string; to_date: string }, today: string) =>
  swap.from_date < today || swap.to_date < today;
