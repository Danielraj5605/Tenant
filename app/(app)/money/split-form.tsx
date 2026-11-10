"use client";

import { useActionState, useState } from "react";
import type { SplitRule } from "@/lib/supabase/types";
import { monthOf, formatMonth } from "@/lib/engine/calendar";
import { isPresent, type AwayPeriod } from "@/lib/engine/presence";
import type { ScheduledMember } from "@/lib/engine/schedule";
import {
  computeShares,
  staffPay,
  daysPresentInMonth,
  defaultParticipants,
  formatINR,
  paiseToInput,
  parseRupees,
  splitTotal,
  statusText,
  type ExpenseItem,
  type ItemKind,
} from "@/lib/engine/money";
import { Avatar, Button, Field, Notice, cx } from "@/components/ui";
import { Badge } from "@/components/away";
import { PlusIcon } from "@/components/icons";
import { saveSplit, type SplitFormState } from "./actions";

/** Carries the cook's and maid's weekly schedule, which pay by days worked uses. */
export type SplitMember = ScheduledMember & { name: string };
export type SplitCategory = { id: string; name: string; default_rule: SplitRule; staff_role: "cook" | "maid" | null };

type ItemDraft = { key: number; name: string; amount: string; kind: ItemKind; included: boolean; personal: string };

export type SplitInitial = {
  id: string | null;
  title: string;
  categoryId: string;
  date: string;
  total: string;
  paidBy: string;
  items: Omit<ItemDraft, "key">[];
  included: string[] | null;
  locks: Record<string, string>;
  /** Set for scanned bills (SPEC 4.7 step 2). */
  scan?: { merchant: string | null; billImagePath: string | null; printedTotalPaise: number };
};

const withoutKey = (o: Record<string, string>, key: string) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

const KIND_LABEL: Record<ItemKind, string> = { item: "Item", fee: "Fee", tax: "Tax", discount: "Discount" };

export function SplitForm({
  members,
  periods,
  categories,
  meId,
  prorate,
  initial,
}: {
  members: SplitMember[];
  periods: AwayPeriod[];
  categories: SplitCategory[];
  meId: string;
  prorate: boolean;
  initial: SplitInitial;
}) {
  const [state, action, pending] = useActionState(saveSplit, {} as SplitFormState);
  const [title, setTitle] = useState(initial.title);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [date, setDate] = useState(initial.date);
  const [total, setTotal] = useState(initial.total);
  const [paidBy, setPaidBy] = useState(initial.paidBy);
  const [items, setItems] = useState<ItemDraft[]>(initial.items.map((i, key) => ({ ...i, key })));
  const [nextKey, setNextKey] = useState(initial.items.length);
  const [locks, setLocks] = useState<Record<string, string>>(initial.locks);
  const [rate, setRate] = useState("");

  const rule = categories.find((c) => c.id === categoryId)?.default_rule ?? "custom";
  const flatmates = members.filter(
    (m) => m.role === "flatmate" && m.joined_on <= date && (!m.left_on || date <= m.left_on),
  );
  const defaults = (r: SplitRule, d: string) => new Set(defaultParticipants(r, members, d, periods));
  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(initial.included ?? defaultParticipants(rule, members, initial.date, periods)),
  );

  // Category or date changes reset people to that rule's defaults and clear locks.
  const resetPeople = (r: SplitRule, d: string) => {
    setIncluded(defaults(r, d));
    setLocks({});
  };

  // ---- items
  const parsedItems: (ExpenseItem & { valid: boolean })[] = items.map((i) => {
    const amount = parseRupees(i.amount);
    return {
      name: i.name.trim(),
      amountPaise: amount ?? 0,
      kind: i.kind,
      included: i.included,
      personalMemberId: i.personal || null,
      valid: amount !== null && i.name.trim().length > 0,
    };
  });
  const hasItems = items.length > 0;
  const itemsTotal = parsedItems.reduce((s, i) => s + (i.kind === "discount" ? -i.amountPaise : i.amountPaise), 0);
  const typedTotal = parseRupees(total);
  // A scanned bill keeps its printed total; the split uses the ticked items.
  const billTotal = initial.scan ? initial.scan.printedTotalPaise : hasItems ? itemsTotal : (typedTotal ?? 0);
  const { split: splitAmount, notSplit } = splitTotal(parsedItems, billTotal);

  // ---- cook pay helper
  const month = monthOf(date);
  const ratePaise = parseRupees(rate);
  // The cook's or maid's days worked (from the category); everyone in that role
  // employed that month counts (e.g. one cook replaced another mid-month).
  const staffRole = categories.find((c) => c.id === categoryId)?.staff_role ?? "cook";
  const cookInfo = rule === "per_day_worked" ? staffPay(staffRole, ratePaise ?? 0, members, month, periods) : null;
  const weighted = rule === "per_day_worked" && prorate;

  // ---- shares
  const personal: Record<string, number> = {};
  for (const i of parsedItems) {
    if (i.included && i.personalMemberId) {
      personal[i.personalMemberId] = (personal[i.personalMemberId] ?? 0) + (i.kind === "discount" ? -i.amountPaise : i.amountPaise);
    }
  }
  const people = flatmates.map((m) => ({
    id: m.id,
    included: included.has(m.id),
    locked: locks[m.id] !== undefined ? (parseRupees(locks[m.id]) ?? 0) : null,
    personal: personal[m.id] ?? 0,
    weight: weighted ? daysPresentInMonth(m, month, periods) : 1,
  }));
  const result = computeShares(splitAmount, people);
  const badLock = Object.entries(locks).some(([id, v]) => included.has(id) && parseRupees(v) === null);
  const itemsValid = parsedItems.every((i) => i.valid);
  const canSave =
    result.canSave && !badLock && itemsValid && title.trim() && categoryId && paidBy && (hasItems || typedTotal);

  const payload = {
    id: initial.id,
    title: title.trim(),
    merchant: initial.scan?.merchant ?? null,
    categoryId,
    date,
    paidBy,
    totalPaise: billTotal,
    source: initial.scan ? "scan" : "manual",
    billImagePath: initial.scan?.billImagePath ?? null,
    items: parsedItems.map((i) => ({
      name: i.name,
      amountPaise: i.amountPaise,
      kind: i.kind,
      included: i.included,
      personalMemberId: i.personalMemberId,
      quantity: null,
    })),
    shares: flatmates
      .filter((m) => included.has(m.id))
      .map((m) => ({ memberId: m.id, amountPaise: result.shares[m.id] ?? 0, isCustom: locks[m.id] !== undefined })),
    dailyRatePaise: rule === "per_day_worked" ? ratePaise : null,
  };

  const statusTone =
    result.status.kind === "ok" ? "text-accent-dark" : result.status.kind === "over" ? "text-danger" : "text-warn-ink";

  return (
    <form data-wide action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <section aria-labelledby="details-heading" className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-5">
            <h2 id="details-heading" className="text-title font-bold">
              Details
            </h2>
            <Field
              id="title"
              label="What was it for?"
              placeholder="e.g. Zepto groceries"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="category" className="text-sm font-semibold">
                  Category
                </label>
                <select
                  id="category"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    resetPeople(categories.find((c) => c.id === e.target.value)?.default_rule ?? "custom", date);
                  }}
                  className="min-h-[52px] min-w-0 rounded-xl border border-line-strong bg-surface px-3 text-base hover:border-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="date"
                label="Date"
                type="date"
                value={date}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDate(e.target.value);
                  resetPeople(rule, e.target.value);
                }}
              />
            </div>

            {cookInfo ? (
              <div className="flex flex-col gap-3 rounded-xl bg-accent-tint p-4 text-accent-dark">
                <p className="font-bold">
                  The {staffRole} worked {cookInfo.daysWorked} of {cookInfo.days} days in {formatMonth(month)}.
                </p>
                <p className="text-sm">Full days off are unpaid; part days are paid in full.</p>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Field id="rate" label="Daily rate (₹)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-auto"
                    disabled={!ratePaise || hasItems}
                    onClick={() => ratePaise && setTotal(paiseToInput(cookInfo.totalPaise))}
                  >
                    Use {formatINR(cookInfo.totalPaise)}
                  </Button>
                </div>
              </div>
            ) : null}

            {hasItems ? (
              <div className="flex flex-col gap-1 rounded-xl bg-sunk px-4 py-3">
                <span className="text-sm font-semibold">Total amount</span>
                <span className="text-2xl font-extrabold tabular-nums">{formatINR(billTotal)}</span>
                <span className="text-sm text-muted">
                  {initial.scan
                    ? itemsTotal === billTotal
                      ? "Items add up to the bill total."
                      : `Items add up to ${formatINR(itemsTotal)}; the bill says ${formatINR(billTotal)}.`
                    : "Adds up the line items."}
                </span>
              </div>
            ) : (
              <Field
                id="total"
                label="Total amount (₹)"
                inputMode="decimal"
                placeholder="0"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                error={total && typedTotal === null ? "Enter an amount like 500 or 43.20" : undefined}
              />
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Paid by</legend>
              <div className="flex flex-wrap gap-2">
                {flatmates.map((m) => (
                  <label
                    key={m.id}
                    className={cx(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-4 pl-1 font-semibold",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                      paidBy === m.id ? "border-accent bg-surface text-accent-dark ring-1 ring-accent" : "border-line-strong bg-surface hover:border-ink/40",
                    )}
                  >
                    <input type="radio" name="paidByChoice" checked={paidBy === m.id} onChange={() => setPaidBy(m.id)} className="sr-only" />
                    <Avatar name={m.name} size={32} />
                    {m.id === meId ? "You" : m.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          {/* ---- optional line items ---- */}
          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5" aria-labelledby="items-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="items-heading" className="text-title font-bold">
                Line items <span className="text-base font-medium text-muted">(optional)</span>
              </h2>
              {hasItems && notSplit !== 0 ? (
                <span className="shrink-0 text-sm text-muted">Not split: {formatINR(notSplit)}</span>
              ) : null}
            </div>
            {!hasItems ? (
              <p className="text-sm text-muted">Add lines to split part of a bill, or to give someone an item of their own.</p>
            ) : null}
            {items.map((it, idx) => (
              <div
                key={it.key}
                className={cx(
                  "flex flex-col gap-2 rounded-xl border p-3",
                  it.included ? "border-line-strong bg-surface" : "border-dashed border-line-strong bg-sunk/60",
                )}
              >
                <div className="flex gap-2">
                  <input
                    aria-label={`Item ${idx + 1} name`}
                    placeholder="Item name"
                    value={it.name}
                    maxLength={80}
                    onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, name: e.target.value } : x)))}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 hover:border-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
                  />
                  <input
                    aria-label={`Item ${idx + 1} amount in rupees`}
                    placeholder="₹"
                    inputMode="decimal"
                    value={it.amount}
                    onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, amount: e.target.value } : x)))}
                    className={cx(
                      "min-h-11 w-24 rounded-lg border bg-surface px-3 text-right tabular-nums hover:border-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none",
                      it.amount && parseRupees(it.amount) === null ? "border-danger" : "border-line-strong",
                    )}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <select
                    aria-label={`Item ${idx + 1} type`}
                    value={it.kind}
                    onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, kind: e.target.value as ItemKind } : x)))}
                    className="min-h-11 rounded-lg border border-line-strong bg-surface px-2 hover:border-ink/40 focus:border-accent focus:outline-none"
                  >
                    {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Item ${idx + 1} belongs to`}
                    value={it.personal}
                    onChange={(e) => {
                      const v = e.target.value;
                      setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, personal: v } : x)));
                      if (v) setIncluded((s) => new Set(s).add(v));
                    }}
                    className="min-h-11 rounded-lg border border-line-strong bg-surface px-2 hover:border-ink/40 focus:border-accent focus:outline-none"
                  >
                    <option value="">Shared</option>
                    {flatmates.map((m) => (
                      <option key={m.id} value={m.id}>
                        Only {m.id === meId ? "me" : m.name}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex min-h-11 items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={it.included}
                      onChange={(e) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, included: e.target.checked } : x)))}
                      className="size-5 accent-accent"
                    />
                    Split
                  </label>
                  <button
                    type="button"
                    onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))}
                    className="ml-auto min-h-11 rounded-full px-3 font-bold text-danger hover:bg-warn-bg"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setItems((cur) => [...cur, { key: nextKey, name: "", amount: "", kind: "item", included: true, personal: "" }]);
                setNextKey((k) => k + 1);
              }}
              className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-dashed border-line-strong px-4 text-sm font-bold hover:border-ink/40"
            >
              <PlusIcon size={16} />
              Add a line item
            </button>
          </section>
        </div>

        {/* ---- each person's share ---- */}
        <section
          aria-labelledby="shares-heading"
          className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5 lg:sticky lg:top-8"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="shares-heading" className="text-title font-bold">
              Each person&rsquo;s share
            </h2>
            <button
              type="button"
              onClick={() => setLocks({})}
              disabled={Object.keys(locks).length === 0}
              className="-mr-2 min-h-11 shrink-0 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint disabled:text-muted disabled:hover:bg-transparent"
            >
              Split equally
            </button>
          </div>
          <ul className="flex flex-col rounded-xl border border-line-strong" aria-labelledby="shares-heading">
            {flatmates.map((m) => {
              const on = included.has(m.id);
              const isLocked = locks[m.id] !== undefined;
              const away = !isPresent(m, date, periods);
              return (
                <li key={m.id} className="flex min-h-14 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                  <input
                    type="checkbox"
                    id={`inc-${m.id}`}
                    checked={on}
                    onChange={(e) => {
                      setIncluded((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(m.id);
                        else n.delete(m.id);
                        return n;
                      });
                      if (!e.target.checked) setLocks((cur) => withoutKey(cur, m.id));
                    }}
                    className="size-6 shrink-0 accent-accent"
                  />
                  <label htmlFor={`inc-${m.id}`} className={cx("flex min-w-0 flex-1 items-center gap-2 font-semibold", !on && "text-muted")}>
                    <span className="truncate">{m.id === meId ? "You" : m.name}</span>
                    {away ? <Badge tone="info">Away</Badge> : null}
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">₹</span>
                    <input
                      aria-label={`${m.name}'s share in rupees`}
                      inputMode="decimal"
                      disabled={!on}
                      value={!on ? "" : isLocked ? locks[m.id] : paiseToInput(result.shares[m.id] ?? 0)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocks((cur) => (v.trim() === "" ? withoutKey(cur, m.id) : { ...cur, [m.id]: v }));
                      }}
                      className={cx(
                        "min-h-11 w-28 rounded-lg border pr-3 pl-7 text-right font-semibold tabular-nums hover:border-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:bg-bg",
                        isLocked ? "border-accent bg-accent-tint/50" : "border-line-strong",
                        isLocked && parseRupees(locks[m.id]) === null && "border-danger",
                      )}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">Typing an amount fixes that share. The rest is split among the others.</p>
          <p role="status" aria-live="polite" className={cx("hidden font-bold lg:block", statusTone)}>
            {statusText(result.status)}
          </p>
          {/* The wrapper hides it: the button's own inline-flex would override `hidden`. */}
          <div className="hidden lg:block">
            <Button type="submit" loading={pending} disabled={!canSave}>
              {initial.id ? "Save changes" : "Save split"}
            </Button>
          </div>
        </section>
      </div>

      {/* Phones and tablets: the status and Save stay in reach while scrolling. */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-2 flex items-center justify-between gap-3 rounded-[calc(var(--radius-card)+4px)] border border-line bg-surface/95 py-2 pr-2 pl-4 shadow-[0_8px_30px_rgb(0_0_0/0.08)] backdrop-blur-md lg:hidden">
        <p role="status" aria-live="polite" className={cx("min-w-0 flex-1 text-sm leading-tight font-bold", statusTone)}>
          {statusText(result.status)}
        </p>
        <Button type="submit" loading={pending} disabled={!canSave} className="min-h-12 max-w-fit shrink-0 px-6">
          {initial.id ? "Save changes" : "Save split"}
        </Button>
      </div>
    </form>
  );
}
