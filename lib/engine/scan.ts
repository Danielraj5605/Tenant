/**
 * Bill scan results (SPEC §10). The AI returns rupees; everything after this
 * point is integer paise. Nothing here is saved: the person reviews first.
 */
import { z } from "zod";
import { isIsoDate } from "./dates";
import type { ItemKind } from "./money";

/** What a model must return (SPEC §10 response schema). */
export const ScanResult = z.object({
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().nullable(),
      amount: z.number(),
      kind: z.enum(["item", "fee", "tax", "discount"]),
    }),
  ),
  total: z.number().nullable(),
  warning: z.enum(["total_mismatch"]).optional(),
});
export type ScanResult = z.infer<typeof ScanResult>;

export type ScannedItem = {
  name: string;
  quantity: number | null;
  amountPaise: number;
  kind: ItemKind;
  included: boolean;
};

export type NormalizedScan = {
  merchant: string | null;
  date: string | null;
  items: ScannedItem[];
  totalPaise: number;
  warning?: "total_mismatch";
};

/** Rupees (possibly with float noise) → integer paise. Discounts are stored positive. */
export const rupeesToPaise = (rupees: number) => Math.abs(Math.round(rupees * 100));

/** Tolerance for "items add up to the bill total" (SPEC §10: within ₹1). */
export const TOTAL_TOLERANCE_PAISE = 100;

export function normalizeScan(raw: ScanResult): NormalizedScan {
  const items: ScannedItem[] = raw.items.map((i) => ({
    name: i.name.trim().slice(0, 80) || "Unreadable item",
    quantity: i.quantity !== null && i.quantity > 0 ? i.quantity : null,
    amountPaise: rupeesToPaise(i.amount),
    kind: i.kind,
    included: true,
  }));
  const itemSum = items.reduce((s, i) => s + (i.kind === "discount" ? -i.amountPaise : i.amountPaise), 0);
  const printed = raw.total === null ? null : rupeesToPaise(raw.total);
  const mismatch = printed !== null && Math.abs(printed - itemSum) > TOTAL_TOLERANCE_PAISE;

  return {
    merchant: raw.merchant?.trim().slice(0, 80) || null,
    date: raw.date && isIsoDate(raw.date) ? raw.date : null,
    items,
    totalPaise: printed ?? itemSum,
    ...(mismatch ? { warning: "total_mismatch" as const } : {}),
  };
}

/** Shared prompt for every provider (SPEC §10 "Prompt essentials"). */
export const SCAN_PROMPT = `You read Indian shop and delivery bills (Zepto, Blinkit, Swiggy Instamart, local kirana stores, etc.).
Return ONLY a JSON object with this shape:
{"merchant": string|null, "date": "yyyy-mm-dd"|null, "items": [{"name": string, "quantity": number|null, "amount": number, "kind": "item"|"fee"|"tax"|"discount"}], "total": number|null}
Rules:
- All amounts are in Indian rupees (INR) as plain numbers, e.g. 43.20. "amount" is the line total, not the unit price.
- GST, CGST, SGST, IGST and cess lines are kind "tax".
- Delivery, handling, packaging, platform and small-cart fees are kind "fee".
- Discounts, coupons and savings are kind "discount" with a positive amount.
- Keep item names exactly as printed (English or Tamil). Do not translate.
- "total" is the final amount payable printed on the bill.
- If something is unreadable, use null. Never guess numbers.
- Output JSON only, no prose and no code fences.`;
