/** Shared Zod schemas for Phase 2 forms (used by server actions). */
import { z } from "zod";
import { isIsoDate } from "./dates";
import { MEALS, SLOTS, type AwaySlot } from "./presence";
import { isEveryDay, weekdayIndex, type WorkSchedule } from "./schedule";

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
    // Part-day slots, from repeated "slots" checkboxes (array) or one value.
    slots: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) => {
        const picked = new Set(v === undefined ? [] : Array.isArray(v) ? v : [v]);
        return SLOTS.filter((s) => picked.has(s)) as AwaySlot[];
      }),
    reason: optionalText(120),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "The end date can't be before the start date",
  })
  .refine((v) => v.fullDay || v.startDate === v.endDate, {
    path: ["endDate"],
    message: "Part of the day works for a single day. Set Until to the same day, or tick Away the whole day",
  })
  .refine((v) => v.fullDay || v.slots.length > 0, {
    path: ["slots"],
    message: "Pick morning, afternoon or night",
  })
  .transform((v) => ({ ...v, slots: v.fullDay ? null : v.slots }));
export type AwayPeriodInput = z.infer<typeof AwayPeriodInput>;

/** Optional phone: digits with an optional leading +, spaces and dashes allowed. */
const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/\s+/g, " ") : null))
  .refine((v) => v === null || /^\+?[0-9][0-9 -]{5,18}[0-9]$/.test(v), "Enter a phone number, like 98765 43210");

export const StaffInput = z.object({
  name: memberName,
  role: z.enum(["cook", "maid"], "Choose cook or maid"),
  phone,
});

/** Cook & maid page: any flatmate edits the cook's or maid's details. */
export const StaffEditInput = z.object({
  memberId: z.uuid(),
  name: memberName,
  role: z.enum(["cook", "maid"], "Choose cook or maid"),
  phone,
  leftOn: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isIsoDate(v), "Pick a valid date"),
});
export type StaffEditInput = z.infer<typeof StaffEditInput>;
export type StaffInput = z.infer<typeof StaffInput>;

export const MemberEditInput = z.object({
  memberId: z.uuid(),
  name: memberName,
  /** Only sent for the cook or maid: they can be switched between the two. */
  role: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(z.enum(["cook", "maid"], "Choose cook or maid").optional()),
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
    frequency: z.enum(["daily", "weekly", "custom", "monthly"]),
    /** Monthly only (ignored otherwise). */
    everyMonths: z.coerce.number().int().min(1).max(12).optional(),
    dayOfMonth: z.coerce.number().int().min(1, "Pick a day").max(31, "Pick a day").optional(),
    startMonth: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{4}-(0[1-9]|1[0-2])$/.test(v), "Pick a month"),
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
    if (v.frequency === "monthly") {
      if (!v.everyMonths) ctx.addIssue({ code: "custom", path: ["everyMonths"], message: "Pick how often" });
      if (!v.dayOfMonth) ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "Pick a day" });
      if (!v.startMonth) ctx.addIssue({ code: "custom", path: ["startMonth"], message: "Pick the first month" });
      if (v.rotation.length !== 1) ctx.addIssue({ code: "custom", path: ["rotation"], message: "Choose one person" });
      return;
    }
    if (v.days.length === 0) ctx.addIssue({ code: "custom", path: ["days"], message: "Pick at least one day" });
    if (v.frequency === "weekly" && v.days.length > 1)
      ctx.addIssue({ code: "custom", path: ["days"], message: "Pick one day for a weekly chore" });
  })
  .transform((v) => {
    const monthly = v.frequency === "monthly";
    return {
      name: v.name,
      frequency: v.frequency,
      days: v.frequency === "daily" || monthly ? [] : v.days,
      dueTime: v.dueTime,
      rotation: v.rotation,
      everyMonths: monthly ? v.everyMonths! : null,
      dayOfMonth: monthly ? v.dayOfMonth! : null,
      startMonth: monthly ? `${v.startMonth}-01` : null,
    };
  });
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

const DayPlanInput = z.object({
  mode: z.enum(["every", "alternate", "off"]),
  meals: z.array(z.enum(MEALS)).max(3),
  anchor: z.string().refine(isIsoDate).nullable(),
});

/**
 * Cook & maid weekly schedule, sent as JSON (Monday first). Normalised: anchors
 * only on alternate days, the maid always "all meals", and a plain every-day
 * schedule becomes null.
 */
export const ScheduleInput = z
  .object({
    memberId: z.uuid(),
    role: z.enum(["cook", "maid"]),
    schedule: z
      .string()
      .transform((v, ctx) => {
        try {
          return JSON.parse(v) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "The schedule couldn't be read. Try again." });
          return z.NEVER;
        }
      })
      .pipe(z.array(DayPlanInput).length(7)),
  })
  .superRefine((v, ctx) => {
    v.schedule.forEach((d, i) => {
      if (d.mode === "alternate" && (!d.anchor || weekdayIndex(d.anchor) !== i)) {
        ctx.addIssue({ code: "custom", path: ["schedule", i], message: "Pick which week they work" });
      }
      if (v.role === "cook" && d.mode !== "off" && d.meals.length === 0) {
        ctx.addIssue({ code: "custom", path: ["schedule", i], message: "Pick at least one meal, or set the day to Off" });
      }
    });
  })
  .transform((v) => {
    const schedule: WorkSchedule = v.schedule.map((d) => ({
      mode: d.mode,
      meals: v.role === "maid" ? [...MEALS] : MEALS.filter((m) => d.meals.includes(m)),
      anchor: d.mode === "alternate" ? d.anchor : null,
    }));
    return { memberId: v.memberId, schedule: isEveryDay(schedule) ? null : schedule };
  });
