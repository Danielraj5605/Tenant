import { z } from "zod";

/** Flat codes: 6 characters without look-alikes (see new_flat_code() in SQL). */
const FLAT_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/;

/** "k7m-4qx " → "K7M4QX"; null if it can't be a flat code. */
export function normalizeFlatCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return FLAT_CODE.test(code) ? code : null;
}

/** "K7M4QX" → "K7M-4QX", easier to read out and type. */
export const formatFlatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

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

export const JoinRequestInput = z.object({
  code: z
    .string()
    .transform((v, ctx) => {
      const code = normalizeFlatCode(v);
      if (!code) ctx.addIssue({ code: "custom", message: "Enter the 6-character flat code, e.g. K7M-4QX" });
      return code ?? "";
    }),
  memberName: name(40, "your name"),
});
export type JoinRequestInput = z.infer<typeof JoinRequestInput>;

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
