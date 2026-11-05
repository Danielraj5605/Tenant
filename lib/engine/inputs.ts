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

export const ChoreInput = z
  .object({
    name: z.string().trim().min(1, "Enter a chore name").max(40, "Keep the name under 41 characters"),
    frequency: z.enum(["daily", "weekly", "custom"]),
    days: z
      .string()
      .transform((v) => [...new Set(v.split(",").filter(Boolean).map(Number))].sort((x, y) => x - y))
      .pipe(z.array(z.number().int().min(1).max(7))),
    dueTime: z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Pick a valid time"),
    rotation: z
      .string()
      .transform((v, ctx) => {
        try {
          return JSON.parse(v) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "Choose who takes turns" });
          return z.NEVER;
        }
      })
      .pipe(
        z
          .array(z.uuid())
          .min(1, "Choose at least one person")
          .refine((ids) => new Set(ids).size === ids.length, "Each person can only appear once"),
      ),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "daily") return;
    if (v.days.length === 0) ctx.addIssue({ code: "custom", path: ["days"], message: "Pick at least one day" });
    if (v.frequency === "weekly" && v.days.length > 1)
      ctx.addIssue({ code: "custom", path: ["days"], message: "Pick one day for a weekly chore" });
  })
  .transform((v) => ({ ...v, days: v.frequency === "daily" ? [] : v.days }));
export type ChoreInput = z.infer<typeof ChoreInput>;
