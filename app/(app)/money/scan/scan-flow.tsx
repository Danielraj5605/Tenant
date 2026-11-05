"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressBillPhoto } from "@/lib/image";
import { defaultParticipants, formatINR, paiseToInput, parseRupees, type ItemKind } from "@/lib/engine/money";
import { isPresent, type AwayPeriod } from "@/lib/engine/presence";
import type { NormalizedScan } from "@/lib/engine/scan";
import { Avatar, Button, Field, Notice, Spinner, cx } from "@/components/ui";
import { Badge } from "@/components/away";
import { CameraIcon } from "@/components/icons";
import { SplitForm, type SplitCategory, type SplitMember } from "../split-form";

type Draft = { key: number; name: string; amount: string; kind: ItemKind; included: boolean };

type Phase =
  | { kind: "pick" }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string }
  | { kind: "review" }
  | { kind: "shares" };

const KIND_LABEL: Record<ItemKind, string> = { item: "Item", fee: "Fee", tax: "Tax", discount: "Discount" };

export function ScanFlow({
  flatId,
  meId,
  today,
  members,
  periods,
  categories,
  prorate,
}: {
  flatId: string;
  meId: string;
  today: string;
  members: SplitMember[];
  periods: AwayPeriod[];
  categories: SplitCategory[];
  prorate: boolean;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [preview, setPreview] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(today);
  const [printedTotal, setPrintedTotal] = useState(0);
  const [items, setItems] = useState<Draft[]>([]);
  const [paidBy, setPaidBy] = useState(meId);
  const [categoryId, setCategoryId] = useState(categories.find((c) => c.name === "Groceries")?.id ?? categories[0]?.id);
  const [people, setPeople] = useState<Set<string>>(new Set());

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const rule = categories.find((c) => c.id === categoryId)?.default_rule ?? "present_only";
  const flatmates = members.filter((m) => m.role === "flatmate" && m.joined_on <= date && (!m.left_on || date <= m.left_on));
  const resetPeople = (d: string, r = rule) => setPeople(new Set(defaultParticipants(r, members, d, periods)));

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setPhase({ kind: "working", label: "Shrinking the photo" });
      const blob = await compressBillPhoto(file);
      setPreview(URL.createObjectURL(blob));

      setPhase({ kind: "working", label: "Uploading" });
      const path = `${flatId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await createClient().storage.from("bills").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw new Error("The photo couldn't be uploaded. Check your connection and try again.");
      setImagePath(path);

      setPhase({ kind: "working", label: "Reading the bill" });
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath: path }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<NormalizedScan> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "This bill couldn't be read. Try again.");

      const scan = body as NormalizedScan;
      const d = scan.date ?? today;
      setMerchant(scan.merchant ?? "");
      setDate(d);
      setPrintedTotal(scan.totalPaise);
      setItems(scan.items.map((i, key) => ({ key, name: i.name, amount: paiseToInput(i.amountPaise), kind: i.kind, included: true })));
      resetPeople(d);
      setPhase({ kind: "review" });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong. Try again." });
    }
  }

  // ---------------------------------------------------------------- pick / working / error
  if (phase.kind === "pick" || phase.kind === "working" || phase.kind === "error") {
    return (
      <div className="flex flex-col gap-4">
        {phase.kind === "error" ? <Notice tone="warn">{phase.message}</Notice> : null}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="Bill photo" className="max-h-72 w-full rounded-[var(--radius-card)] object-contain" />
        ) : null}
        {phase.kind === "working" ? (
          <p role="status" className="flex items-center justify-center gap-3 rounded-[var(--radius-card)] bg-surface p-6 font-bold">
            <Spinner /> {phase.label}&hellip;
          </p>
        ) : (
          <label className="flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-dark has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
            <CameraIcon size={20} />
            {phase.kind === "error" ? "Try another photo" : "Take or choose a photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </label>
        )}
        <p className="text-sm text-muted">
          Lay the bill flat in good light. You&rsquo;ll check every line before anything is saved.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------- step 2
  if (phase.kind === "shares") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-muted">Step 2 of 2: each person&rsquo;s share</p>
          <button
            type="button"
            onClick={() => setPhase({ kind: "review" })}
            className="min-h-11 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
          >
            Back to items
          </button>
        </div>
        <SplitForm
          members={members}
          periods={periods}
          categories={categories}
          meId={meId}
          prorate={prorate}
          initial={{
            id: null,
            title: merchant.trim() || "Scanned bill",
            categoryId: categoryId!,
            date,
            total: "",
            paidBy,
            items: items.map((i) => ({ name: i.name, amount: i.amount, kind: i.kind, included: i.included, personal: "" })),
            included: [...people],
            locks: {},
            scan: { merchant: merchant.trim() || null, billImagePath: imagePath!, printedTotalPaise: printedTotal },
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------- step 1
  const parsed = items.map((i) => ({ ...i, paise: parseRupees(i.amount) }));
  const signed = (i: (typeof parsed)[number]) => ((i.kind === "discount" ? -1 : 1) * (i.paise ?? 0));
  const itemSum = parsed.reduce((s, i) => s + signed(i), 0);
  const ticked = parsed.filter((i) => i.included).reduce((s, i) => s + signed(i), 0);
  const adds = Math.abs(itemSum - printedTotal) <= 100;
  const allValid = parsed.every((i) => i.paise !== null && i.name.trim());
  const canNext = allValid && ticked > 0 && people.size > 0 && paidBy && categoryId;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-bold text-muted">Step 1 of 2: items and people</p>

      <div className="flex gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="Bill photo" className="h-28 w-20 shrink-0 rounded-xl object-cover" />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-muted">Bill total</span>
          <span className="text-2xl font-extrabold">{formatINR(printedTotal)}</span>
          <span className={cx("text-sm font-bold", adds ? "text-accent-dark" : "text-warn-ink")}>
            {adds ? "✓ Items add up to the bill total" : `Items add up to ${formatINR(itemSum)}. Check for misread lines.`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="merchant" label="Shop" value={merchant} maxLength={80} onChange={(e) => setMerchant(e.target.value)} />
        <Field
          id="date"
          label="Date"
          type="date"
          value={date}
          onChange={(e) => {
            if (!e.target.value) return;
            setDate(e.target.value);
            resetPeople(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-semibold">
          Category
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            resetPeople(date, categories.find((c) => c.id === e.target.value)?.default_rule);
          }}
          className="min-h-[52px] rounded-xl border border-line-strong bg-surface px-3 text-base"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Paid by</legend>
        <div className="flex flex-wrap gap-2">
          {flatmates.map((m) => (
            <label
              key={m.id}
              className={cx(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-4 pl-1 font-semibold",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                paidBy === m.id ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong bg-surface",
              )}
            >
              <input type="radio" checked={paidBy === m.id} onChange={() => setPaidBy(m.id)} className="sr-only" />
              <Avatar name={m.name} size={32} />
              {m.id === meId ? "You" : m.name}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="lines" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 id="lines" className="text-sm font-semibold">
            Lines on the bill
          </h2>
          <span className="text-sm text-muted">Splitting {formatINR(ticked)}</span>
        </div>
        <ul className="flex flex-col rounded-xl border border-line-strong bg-surface">
          {items.map((it, idx) => {
            const bad = parseRupees(it.amount) === null;
            const update = (patch: Partial<Draft>) =>
              setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, ...patch } : x)));
            return (
              <li key={it.key} className="flex flex-col gap-1 border-b border-line px-3 py-2 last:border-b-0">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={it.included}
                    onChange={(e) => update({ included: e.target.checked })}
                    aria-label={`Split ${it.name}`}
                    className="size-6 shrink-0 accent-accent"
                  />
                  <input
                    aria-label={`Line ${idx + 1} name`}
                    value={it.name}
                    maxLength={80}
                    onChange={(e) => update({ name: e.target.value })}
                    className={cx(
                      "min-h-11 min-w-0 flex-1 rounded-lg border border-transparent px-2 font-semibold hover:border-line-strong focus:border-accent focus:outline-none",
                      !it.included && "text-muted line-through",
                    )}
                  />
                  <input
                    aria-label={`Line ${idx + 1} amount in rupees`}
                    inputMode="decimal"
                    value={it.amount}
                    onChange={(e) => update({ amount: e.target.value })}
                    className={cx(
                      "min-h-11 w-24 rounded-lg border px-2 text-right font-semibold focus:border-accent focus:outline-none",
                      bad ? "border-danger" : "border-transparent hover:border-line-strong",
                    )}
                  />
                </div>
                <div className="flex items-center gap-2 pl-8 text-xs font-semibold text-muted">
                  {it.kind !== "item" ? <Badge tone="neutral">{KIND_LABEL[it.kind]}</Badge> : null}
                  {!it.included ? <span>Not split · stays with payer</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Who shares the ticked items</legend>
        <div className="flex flex-wrap gap-2">
          {flatmates.map((m) => {
            const on = people.has(m.id);
            const away = !isPresent(m, date, periods);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setPeople((s) => {
                    const n = new Set(s);
                    if (on) n.delete(m.id);
                    else n.add(m.id);
                    return n;
                  })
                }
                className={cx(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold",
                  on ? "border-accent bg-accent-tint text-accent-dark" : "border-dashed border-line-strong text-muted",
                )}
              >
                {m.id === meId ? "You" : m.name}
                {away ? <span className="text-xs">(away)</span> : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Button disabled={!canNext} onClick={() => setPhase({ kind: "shares" })}>
        Next: check each share
      </Button>
    </div>
  );
}
