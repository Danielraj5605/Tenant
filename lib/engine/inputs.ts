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

const paise = z.number().int().min(0).max(100_000_000);

export const ExpensePayload = z
  .object({
    id: z.uuid().nullable(),
    title: z.string().trim().min(1, "Say what it was for").max(80),
    merchant: z.string().trim().max(80).nullable(),
    categoryId: z.uuid("Pick a category"),
    date: z.string().refine(isIsoDate, "Pick a date"),
    paidBy: z.uuid("Choose who paid"),
    totalPaise: paise.refine((v) => v > 0, "Enter the total"),
    source: z.enum(["manual", "scan"]),
    billImagePath: z.string().max(200).nullable(),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Name every item").max(80),
          quantity: z.number().positive().nullable(),
          amountPaise: paise,
          kind: z.enum(["item", "fee", "tax", "discount"]),
          included: z.boolean(),
          personalMemberId: z.uuid().nullable(),
        }),
      )
      .max(150),
    shares: z
      .array(z.object({ memberId: z.uuid(), amountPaise: paise, isCustom: z.boolean() }))
      .min(1, "Pick at least one person")
      .refine((s) => new Set(s.map((x) => x.memberId)).size === s.length, "Each person once"),
    dailyRatePaise: paise.nullable(),
  })
  .superRefine((v, ctx) => {
    const signed = (i: (typeof v.items)[number]) => (i.kind === "discount" ? -i.amountPaise : i.amountPaise);
    const split = v.items.length ? v.items.filter((i) => i.included).reduce((s, i) => s + signed(i), 0) : v.totalPaise;
    const sum = v.shares.reduce((s, x) => s + x.amountPaise, 0);
    if (split <= 0) ctx.addIssue({ code: "custom", path: ["items"], message: "Tick at least one item to split" });
    if (sum !== split) ctx.addIssue({ code: "custom", path: ["shares"], message: "Shares must add up to the split total" });
  });
export type ExpensePayload = z.infer<typeof ExpensePayload>;
