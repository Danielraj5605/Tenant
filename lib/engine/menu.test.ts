import { describe, expect, it } from "vitest";
import { cookStatusOn, mealPlanOf, mealPlans, weekDates, weekStart, withMealPlans } from "./menu";
import type { AwayPeriod, AwaySlot, PresenceMember } from "./presence";

const cook: PresenceMember = { id: "cook", role: "cook", joined_on: "2026-01-01", left_on: null };
const leave = (full_day: boolean, slots: AwaySlot[] | null = null): AwayPeriod => ({
  member_id: "cook",
  start_date: "2026-11-07",
  end_date: "2026-11-07",
  full_day,
  slots,
});
const ALL = ["breakfast", "lunch", "dinner"];

describe("weekStart and weekDates", () => {
  it("starts weeks on Monday", () => {
    expect(weekStart("2026-11-05")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekDates("2026-11-02")).toHaveLength(7);
    expect(weekDates("2026-11-02")[6]).toBe("2026-11-08");
  });
});

describe("cookStatusOn", () => {
  it("is 'cooking' on a normal day", () => {
    expect(cookStatusOn([cook], "2026-11-06", [leave(true)])).toEqual({ noCook: false, noCookMeals: [], paid: true });
  });

  it("full-day leave: no cook for every meal, day unpaid (SPEC §12 case 11)", () => {
    expect(cookStatusOn([cook], "2026-11-07", [leave(true)])).toEqual({ noCook: true, noCookMeals: ALL, paid: false });
  });

  it("part-day leave at night: no cook for dinner only, day still paid (SPEC §12 case 12)", () => {
    expect(cookStatusOn([cook], "2026-11-07", [leave(false, ["night"])])).toEqual({
      noCook: true,
      noCookMeals: ["dinner"],
      paid: true,
    });
  });

  it("part-day leave in the morning and afternoon: no cook for breakfast and lunch", () => {
    expect(cookStatusOn([cook], "2026-11-07", [leave(false, ["afternoon", "morning"])]).noCookMeals).toEqual([
      "breakfast",
      "lunch",
    ]);
  });

  it("no cook in the flat means no 'No cook' prompts", () => {
    expect(cookStatusOn([], "2026-11-07", [])).toEqual({ noCook: false, noCookMeals: [], paid: false });
  });
});

describe("per-meal plans", () => {
  it("a meal follows the day's plan unless it has its own", () => {
    expect(mealPlanOf({ plan: "order_in" }, "lunch")).toBe("order_in");
    expect(mealPlanOf({ plan: "cook", meal_plans: { dinner: "self_cook" } }, "dinner")).toBe("self_cook");
    expect(mealPlanOf({ plan: "cook", meal_plans: { dinner: "self_cook" } }, "lunch")).toBe("cook");
    expect(mealPlanOf(null, "breakfast")).toBe("cook");
  });

  it("setting one meal keeps the others; all the same updates the day", () => {
    expect(withMealPlans({ plan: "cook" }, ["dinner"], "order_in")).toEqual({
      meal_plans: { breakfast: "cook", lunch: "cook", dinner: "order_in" },
      plan: "cook",
    });
    expect(withMealPlans({ plan: "cook", meal_plans: { dinner: "order_in" } }, ["breakfast", "lunch"], "order_in")).toEqual({
      meal_plans: { breakfast: "order_in", lunch: "order_in", dinner: "order_in" },
      plan: "order_in",
    });
    expect(mealPlans({ plan: "self_cook", meal_plans: { lunch: "order_in" } })).toEqual({
      breakfast: "self_cook",
      lunch: "order_in",
      dinner: "self_cook",
    });
  });
});
