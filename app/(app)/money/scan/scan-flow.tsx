"use client";

import { useEffect, useState } from "react";
import { compressBillPhoto } from "@/lib/image";
import { defaultParticipants, formatINR, paiseToInput, parseRupees, type ItemKind } from "@/lib/engine/money";
import { isPresent, type AwayPeriod } from "@/lib/engine/presence";
import type { NormalizedScan } from "@/lib/engine/scan";
import { Avatar, Button, Field, Notice, Spinner, cx } from "@/components/ui";
import { Badge } from "@/components/away";
import { CameraIcon, CheckIcon, FileTextIcon, UploadIcon } from "@/components/icons";
import { SplitForm, type SplitCategory, type SplitMember } from "../split-form";

type Draft = { key: number; name: string; amount: string; kind: ItemKind; included: boolean };

type Phase =
  | { kind: "pick" }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string }
  | { kind: "review" }
  | { kind: "shares" };

const KIND_LABEL: Record<ItemKind, string> = { item: "Item", fee: "Fee", tax: "Tax", discount: "Discount" };

/** Same cap as /api/scan and the bills bucket (Vercel limits a request to 4.5 MB). */
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const isPdfFile = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

export function ScanFlow({
  meId,
  today,
  members,
  periods,
  categories,
  prorate,
}: {
  meId: string;
  today: string;
  members: SplitMember[];
  periods: AwayPeriod[];
  categories: SplitCategory[];
  prorate: boolean;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [preview, setPreview] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
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
      const pdf = isPdfFile(file);
      let upload: Blob;
      if (pdf) {
        if (file.size > MAX_PDF_BYTES) throw new Error("That PDF is over 4 MB. Upload a photo or screenshot of the bill instead.");
        upload = new Blob([file], { type: "application/pdf" });
        setPreview(null);
        setPdfName(file.name);
      } else {
        if (file.type && !file.type.startsWith("image/")) throw new Error("Upload a photo (JPG or PNG) or a PDF of the bill.");
        setPhase({ kind: "working", label: "Shrinking the photo" });
        upload = await compressBillPhoto(file).catch(() => {
          throw new Error("This photo format can't be opened here. Try a JPG, PNG or a screenshot of the bill.");
        });
        setPreview(URL.createObjectURL(upload));
        setPdfName(null);
      }

      setPhase({ kind: "working", label: pdf ? "Reading the PDF" : "Reading the bill" });
      const data = new FormData();
      data.append("photo", upload, pdf ? "bill.pdf" : "bill.jpg");
      const res = await fetch("/api/scan", { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as Partial<NormalizedScan> & { error?: string };
      if (!res.ok || !Array.isArray(body.items)) throw new Error(body.error ?? "This bill couldn't be read. Check your connection and try again.");

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
    const working = phase.kind === "working";
    return (
      <div className="flex flex-col gap-4">
        {phase.kind === "error" ? <Notice tone="warn">{phase.message}</Notice> : null}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="Bill photo" className="max-h-72 w-full rounded-[var(--radius-card)] object-contain" />
        ) : pdfName ? (
          <PdfChip name={pdfName} />
        ) : null}
        {working ? (
          <p role="status" className="flex items-center justify-center gap-3 rounded-[var(--radius-card)] bg-surface p-6 font-bold">
            <Spinner /> {phase.label}&hellip;
          </p>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cx(
              "flex flex-col gap-3 rounded-[var(--radius-card)] transition-colors lg:border-2 lg:border-dashed lg:p-8",
              dragging ? "lg:border-accent lg:bg-accent-tint" : "lg:border-line-strong lg:bg-surface",
            )}
          >
            <p className="hidden text-center font-semibold lg:block">
              {dragging ? "Drop to read the bill" : "Drop a bill photo or PDF here, or"}
            </p>
            {/* Phones open the camera straight away; desktops have no camera step. */}
            <FilePick label="Take a photo" accept="image/*" capture icon={<CameraIcon size={20} />} onFile={handleFile} className="lg:hidden" primary />
            <FilePick
              label="Upload a photo or PDF"
              accept="image/*,application/pdf,.pdf"
              icon={<UploadIcon size={20} />}
              onFile={handleFile}
              className="lg:mx-auto lg:w-fit lg:border-transparent lg:bg-accent lg:text-white lg:hover:bg-accent-dark"
            />
          </div>
        )}
        <p className="text-sm text-muted">
          Photos: lay the bill flat in good light. PDFs up to 4 MB work too, such as e-bills and online orders. The file is only read, not kept.
          You&rsquo;ll check every line before anything is saved.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------- step 2
  if (phase.kind === "shares") {
    return (
      <div className="flex flex-col gap-4">
        <StepIndicator step={2} onBack={() => setPhase({ kind: "review" })} />
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
            scan: { merchant: merchant.trim() || null, billImagePath: null, printedTotalPaise: printedTotal },
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
    <div data-wide className="flex flex-col gap-4">
      <StepIndicator step={1} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <section aria-label="Bill total" className="flex gap-4 rounded-[var(--radius-card)] bg-surface p-5">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={preview} alt="Bill photo" className="h-28 w-20 shrink-0 rounded-xl border border-line object-cover" />
            ) : pdfName ? (
              <span className="flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-sunk text-muted" title={pdfName}>
                <FileTextIcon size={28} />
                <span className="text-xs font-bold">PDF</span>
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm font-semibold text-muted">Bill total</span>
              <span className="text-2xl font-extrabold tabular-nums">{formatINR(printedTotal)}</span>
              <span className={cx("text-sm font-bold", adds ? "text-accent-dark" : "text-warn-ink")}>
                {adds ? "✓ Items add up to the bill total" : `Items add up to ${formatINR(itemSum)}. Check for misread lines.`}
              </span>
            </div>
          </section>

          <section aria-labelledby="scan-details-heading" className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-surface p-5">
            <h2 id="scan-details-heading" className="text-title font-bold">
              Details
            </h2>
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
                className="min-h-[52px] rounded-xl border border-line-strong bg-surface px-3 text-base hover:border-ink/40 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
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
                      paidBy === m.id ? "border-accent bg-surface text-accent-dark ring-1 ring-accent" : "border-line-strong bg-surface hover:border-ink/40",
                    )}
                  >
                    <input type="radio" checked={paidBy === m.id} onChange={() => setPaidBy(m.id)} className="sr-only" />
                    <Avatar name={m.name} size={32} />
                    {m.id === meId ? "You" : m.name}
                  </label>
                ))}
              </div>
            </fieldset>

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
                        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold transition-colors",
                        on ? "border-accent bg-accent-tint text-accent-dark" : "border-dashed border-line-strong text-muted hover:border-ink/40 hover:text-ink",
                      )}
                    >
                      {on ? <CheckIcon size={16} strokeWidth={2.5} /> : null}
                      {m.id === meId ? "You" : m.name}
                      {away ? <span className="text-xs">(away)</span> : null}
                    </button>
                  );
                })}
              </div>
              {people.size === 0 ? <p className="text-sm font-semibold text-warn-ink">Pick at least one person.</p> : null}
            </fieldset>
          </section>
        </div>

        <section aria-labelledby="lines" className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5 lg:sticky lg:top-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="lines" className="text-title font-bold">
              Lines on the bill
            </h2>
            <span className="shrink-0 text-sm font-semibold text-muted tabular-nums">Splitting {formatINR(ticked)}</span>
          </div>
          <p className="text-sm text-muted">Untick anything that isn&rsquo;t shared. Tap a name or amount to fix a misread line.</p>
          <ul className="flex flex-col rounded-xl border border-line-strong">
            {items.map((it, idx) => {
              const bad = parseRupees(it.amount) === null;
              const update = (patch: Partial<Draft>) =>
                setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, ...patch } : x)));
              return (
                <li key={it.key} className={cx("flex flex-col gap-1 border-b border-line px-3 py-2 last:border-b-0", !it.included && "bg-sunk/60")}>
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
                        "min-h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-semibold hover:border-line-strong focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/25 focus:outline-none",
                        !it.included && "text-muted line-through",
                      )}
                    />
                    <input
                      aria-label={`Line ${idx + 1} amount in rupees`}
                      inputMode="decimal"
                      value={it.amount}
                      onChange={(e) => update({ amount: e.target.value })}
                      className={cx(
                        "min-h-11 w-24 rounded-lg border bg-transparent px-2 text-right font-semibold tabular-nums focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/25 focus:outline-none",
                        bad ? "border-danger" : "border-transparent hover:border-line-strong",
                      )}
                    />
                  </div>
                  {it.kind !== "item" || !it.included ? (
                    <div className="flex items-center gap-2 pl-8 text-xs font-semibold text-muted">
                      {it.kind !== "item" ? <Badge tone="neutral">{KIND_LABEL[it.kind]}</Badge> : null}
                      {!it.included ? <span>Not split · stays with payer</span> : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {/* The wrapper hides it: the button's own inline-flex would override `hidden`. */}
          <div className="hidden lg:block">
            <Button disabled={!canNext} onClick={() => setPhase({ kind: "shares" })}>
              Next: check each share
            </Button>
          </div>
        </section>
      </div>

      {/* Phones and tablets: what is being split and Next stay in reach. */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-2 flex items-center justify-between gap-3 rounded-[calc(var(--radius-card)+4px)] border border-line bg-surface/95 py-2 pr-2 pl-4 shadow-[0_8px_30px_rgb(0_0_0/0.08)] backdrop-blur-md lg:hidden">
        <p className="min-w-0 flex-1 text-sm leading-tight font-bold tabular-nums">
          Splitting {formatINR(ticked)}
          <span className="block text-xs font-semibold text-muted">
            {people.size} {people.size === 1 ? "person" : "people"}
          </span>
        </p>
        <Button disabled={!canNext} onClick={() => setPhase({ kind: "shares" })} className="min-h-12 max-w-fit shrink-0 px-6">
          Next: shares
        </Button>
      </div>
    </div>
  );
}

/** "Items and people" → "Each person's share", for the two scan steps. */
function StepIndicator({ step, onBack }: { step: 1 | 2; onBack?: () => void }) {
  const steps = ["Items and people", "Each person’s share"];
  return (
    <div className="flex items-center justify-between gap-3">
      <ol className="flex min-w-0 items-center gap-2 text-sm font-bold" aria-label={`Step ${step} of 2`}>
        {steps.map((label, i) => {
          const n = i + 1;
          const current = n === step;
          return (
            <li key={label} className="flex min-w-0 items-center gap-2" aria-current={current ? "step" : undefined}>
              {i ? <span className="h-px w-4 shrink-0 bg-line-strong" aria-hidden="true" /> : null}
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                  current ? "bg-accent text-white" : n < step ? "bg-accent-tint text-accent-dark" : "bg-line text-muted",
                )}
                aria-hidden="true"
              >
                {n < step ? <CheckIcon size={14} strokeWidth={3} /> : n}
              </span>
              <span className={cx("truncate", current ? "text-ink" : "text-muted max-sm:sr-only")}>{label}</span>
            </li>
          );
        })}
      </ol>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="-mr-2 min-h-11 shrink-0 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
        >
          Back to items
        </button>
      ) : null}
    </div>
  );
}

/** A button that opens the file picker (or the camera, with `capture`). */
function FilePick({
  label,
  accept,
  capture = false,
  icon,
  onFile,
  primary = false,
  className,
}: {
  label: string;
  accept: string;
  capture?: boolean;
  icon: React.ReactNode;
  onFile: (file: File | undefined) => void;
  primary?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full px-6 font-bold transition-colors",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        primary ? "bg-accent text-white hover:bg-accent-dark" : "border border-line-strong bg-surface text-ink hover:border-ink/40",
        className,
      )}
    >
      {icon}
      {label}
      <input
        type="file"
        accept={accept}
        capture={capture ? "environment" : undefined}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = ""; // picking the same file again still fires
        }}
      />
    </label>
  );
}

function PdfChip({ name }: { name: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-tint text-accent-dark">
        <FileTextIcon size={22} />
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
    </div>
  );
}
