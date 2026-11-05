import { z } from "zod";

/** Invite codes are 12 URL-safe characters (see new_invite_code() in SQL). */
const INVITE_CODE = /^[A-Za-z0-9_-]{8,32}$/;

const name = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .max(max, `Keep ${label} under ${max + 1} characters`);

export const CreateFlatInput = z.object({
  flatName: name(60, "a flat name"),
  memberName: name(40, "your name"),
});
export type CreateFlatInput = z.infer<typeof CreateFlatInput>;

export const JoinFlatInput = z.object({
  code: z.string().trim().regex(INVITE_CODE, "This invite link is not valid"),
  memberName: name(40, "your name"),
});
export type JoinFlatInput = z.infer<typeof JoinFlatInput>;

/** First name from the auth profile, else the email's local part. */
export function defaultMemberName(
  metadata: Record<string, unknown> | undefined | null,
  email: string | undefined | null,
): string {
  const raw =
    (typeof metadata?.full_name === "string" && metadata.full_name) ||
    (typeof metadata?.name === "string" && metadata.name) ||
    "";
  const first = raw.trim().split(/\s+/)[0] ?? "";
  const fallback = email ? email.split("@")[0] : "";
  return (first || fallback).slice(0, 40);
}

/** Accepts a bare invite code or a full `/join/<code>` link. */
export function inviteCodeFrom(input: string): string | null {
  const value = input.trim();
  if (INVITE_CODE.test(value)) return value;
  const match = value.match(/\/join\/([A-Za-z0-9_-]+)/);
  return match && INVITE_CODE.test(match[1]) ? match[1] : null;
}

/** Only same-site absolute paths; anything else goes to Today. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/today";
  }
  return next;
}

/** Usernames are lowercase; stored in app_users.username. */
export const Username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,20}$/, "Use 3–20 letters, numbers, dots, dashes or underscores");

export const Password = z.string().min(8, "Use at least 8 characters").max(72, "Keep it under 73 characters");
