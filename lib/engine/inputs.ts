/** Shared Zod schemas for Phase 2 forms (used by server actions). */
import { z } from "zod";
import { isIsoDate } from "./dates";

const isoDate = (label: string) => z.string().refine(isIsoDate, `Pick ${label}`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max + 1} characters`)
    .optional()
    .transform((v) => (v ? v : null));

const memberName = z.string().trim().min(1, "Enter a name").max(40, "Keep the name under 41 characters");

export const AwayPeriodInput = z
  .object({
    memberId: z.uuid("Choose who is away"),
    startDate: isoDate("a start date"),
    endDate: isoDate("an end date"),
    // HTML checkbox: present ("true"/"on") when ticked, missing when not.
    fullDay: z
      .union([z.literal("true"), z.literal("on"), z.literal("false"), z.boolean()])
      .optional()
      .transform((v) => v === true || v === "true" || v === "on"),
    reason: optionalText(120),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "The end date can't be before the start date",
  });
export type AwayPeriodInput = z.infer<typeof AwayPeriodInput>;

export const StaffInput = z.object({
  name: memberName,
  role: z.enum(["cook", "maid"], "Choose cook or maid"),
});
export type StaffInput = z.infer<typeof StaffInput>;

export const MemberEditInput = z.object({
  memberId: z.uuid(),
  name: memberName,
  leftOn: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isIsoDate(v), "Pick a valid date"),
});
export type MemberEditInput = z.infer<typeof MemberEditInput>;
