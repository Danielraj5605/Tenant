/**
 * Who may change what (own data; the admin may change anyone's).
 * Pure functions: the server actions and the database functions enforce the
 * same rules; pages use these to decide which buttons to show.
 */
export type Actor = { id: string; is_admin: boolean };
type Person = { id: string; role: "flatmate" | "cook" | "maid" };

/**
 * Away days: your own, or the cook's and maid's leave (they don't sign in, so
 * any flatmate marks it). The admin can change anyone's.
 */
export const canEditAwayFor = (me: Actor, person: Person) =>
  me.is_admin || person.id === me.id || person.role !== "flatmate";

/** A split: the person who created it, or the admin. */
export const canManageExpense = (me: Actor, expense: { created_by: string }) =>
  me.is_admin || expense.created_by === me.id;

/** A chore duty: the person on duty, or the admin. */
export const canMarkDuty = (me: Actor, duty: { member_id: string | null }) =>
  duty.member_id !== null && (me.is_admin || duty.member_id === me.id);
