import { describe, expect, it } from "vitest";
import { ScanResult, normalizeScan, rupeesToPaise } from "./scan";

describe("rupeesToPaise", () => {
  it("converts model rupee amounts to integer paise, rounding float noise", () => {
    expect(rupeesToPaise(298)).toBe(29800);
    expect(rupeesToPaise(43.2)).toBe(4320);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(rupeesToPaise(19.999)).toBe(2000);
  });

  it("stores discounts as positive amounts", () => {
    expect(rupeesToPaise(-25)).toBe(2500);
  });
});

describe("ScanResult schema (SPEC §10)", () => {
  it("accepts the documented shape", () => {
    const ok = ScanResult.safeParse({
      merchant: "Zepto",
      date: "2026-11-05",
      items: [{ name: "Harpic", quantity: 1, amount: 195, kind: "item" }],
      total: 195,
    });
    expect(ok.success).toBe(true);
  });

  it("allows nulls for unreadable fields", () => {
    expect(ScanResult.safeParse({ merchant: null, date: null, items: [], total: null }).success).toBe(true);
  });

  it("treats missing optional fields as null instead of failing the bill", () => {
    const r = ScanResult.safeParse({ items: [{ name: "Milk", amount: 27, kind: "item" }] });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ merchant: null, date: null, total: null, items: [{ quantity: null }] });
  });

  it("keeps a line with an unreadable (null) amount as ₹0 to fix in review", () => {
    const r = ScanResult.parse({ merchant: null, date: null, items: [{ name: "Smudged", quantity: null, amount: null, kind: "item" }], total: 50 });
    const n = normalizeScan(r);
    expect(n.items[0]).toMatchObject({ name: "Smudged", amountPaise: 0 });
    expect(n.warning).toBe("total_mismatch");
  });

  it("rejects unknown kinds", () => {
    const bad = { merchant: null, date: null, items: [{ name: "x", quantity: null, amount: 1, kind: "tip" }], total: null };
    expect(ScanResult.safeParse(bad).success).toBe(false);
  });
});

describe("normalizeScan", () => {
  const zepto = {
    merchant: "Zepto",
    date: "2026-11-05",
    items: [
      { name: "Wheat flour 500 g", quantity: 1, amount: 298, kind: "item" as const },
      { name: "Harpic", quantity: 1, amount: 195, kind: "item" as const },
      { name: "Delivery charge", quantity: null, amount: 5, kind: "fee" as const },
      { name: "Handling fee", quantity: null, amount: 2, kind: "fee" as const },
    ],
    total: 500,
  };

  it("converts to paise and passes when items add up to the bill total", () => {
    const r = normalizeScan(zepto);
    expect(r.items.map((i) => i.amountPaise)).toEqual([29800, 19500, 500, 200]);
    expect(r.totalPaise).toBe(50000);
    expect(r.warning).toBeUndefined();
    expect(r.items.every((i) => i.included)).toBe(true);
  });

  it("subtracts discounts and tolerates up to ₹1 of rounding", () => {
    const r = normalizeScan({
      ...zepto,
      items: [...zepto.items, { name: "Coupon", quantity: null, amount: -20, kind: "discount" }],
      total: 480.6,
    });
    expect(r.warning).toBeUndefined();
  });

  it("warns with total_mismatch when off by more than ₹1", () => {
    expect(normalizeScan({ ...zepto, total: 520 }).warning).toBe("total_mismatch");
  });

  it("falls back to the item sum when the total is unreadable", () => {
    const r = normalizeScan({ ...zepto, total: null });
    expect(r.totalPaise).toBe(50000);
    expect(r.warning).toBeUndefined();
  });

  it("drops an invalid date instead of guessing", () => {
    expect(normalizeScan({ ...zepto, date: "05/11/2026" }).date).toBeNull();
    expect(normalizeScan({ ...zepto, date: "2026-02-30" }).date).toBeNull();
  });

  it("names unnamed lines so they can be reviewed", () => {
    const r = normalizeScan({ ...zepto, items: [{ name: "  ", quantity: null, amount: 10, kind: "item" }], total: 10 });
    expect(r.items[0].name).toBe("Unreadable item");
  });
});
