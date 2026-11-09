"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Avatar, Button, Notice, cx } from "@/components/ui";
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, PlusIcon, XIcon } from "@/components/icons";
import { saveAllChores, type AllChoresState } from "../actions";

export type ChoreDraft = {
  /** The chore id, or "new-N" for one added on this screen. */
  key: string;
  id: string | null;
  name: string;
  /** ISO weekdays, 1 = Monday. All seven means every day. */
  days: number[];
  dueTime: string;
  rotation: string[];
  deleted: boolean;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL = [1, 2, 3, 4, 5, 6, 7];

const sameDraft = (a: ChoreDraft, b: ChoreDraft) =>
  a.name.trim() === b.name.trim() &&
  a.dueTime === b.dueTime &&
  a.deleted === b.deleted &&
  a.days.join() === b.days.join() &&
  a.rotation.join() === b.rotation.join();

const chip = (active: boolean) =>
  cx(
    "flex min-h-11 items-center justify-center rounded-full border text-sm font-bold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    active ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong bg-surface text-ink hover:border-ink/40",
  );

const inputClass = (error?: string) =>
  cx(
    "min-h-11 w-full min-w-0 rounded-lg border bg-surface px-3 text-base text-ink placeholder:text-muted/70",
    "hover:border-ink/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
    error ? "border-danger" : "border-line-strong",
  );

function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="text-sm font-semibold text-danger" role="alert">
      {children}
    </p>
  );
}

/**
 * Every chore on one screen: name, days, time and rotation, plus add and
 * delete. Nothing is saved until "Save changes", which saves them all.
 */
export function EditAllChores({
  initial,
  flatmates,
}: {
  initial: ChoreDraft[];
  flatmates: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveAllChores, {} as AllChoresState);
  const [drafts, setDrafts] = useState(initial);
  const focusKey = useRef<string | null>(null);
  const nextNew = useRef(1);
  const nameOf = new Map(flatmates.map((f) => [f.id, f.name]));
  const original = new Map(initial.map((d) => [d.key, d]));

  const changed = drafts.filter((d) => {
    const before = original.get(d.key);
    return before ? !sameDraft(d, before) : !d.deleted;
  });
  const dirty = changed.length > 0;

  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  // Put the cursor in a newly added chore's name.
  useEffect(() => {
    if (!focusKey.current) return;
    document.getElementById(`chore-${focusKey.current}-name`)?.focus();
    focusKey.current = null;
  }, [drafts]);

  const update = (key: string, patch: Partial<ChoreDraft>) =>
    setDrafts((cur) => cur.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const addChore = () => {
    const key = `new-${nextNew.current++}`;
    setDrafts((cur) => [
      ...cur,
      { key, id: null, name: "", days: ALL, dueTime: "", rotation: flatmates.map((f) => f.id), deleted: false },
    ]);
    focusKey.current = key;
  };

  // New chores that were removed again are simply dropped.
  const payload = JSON.stringify(changed.filter((d) => d.id || !d.deleted));
  const visible = drafts.filter((d) => d.id || !d.deleted);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="payload" value={payload} />

      {visible.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-5">
          <h2 className="text-title font-bold">No chores yet</h2>
          <p className="text-muted">Add garbage, kitchen cleaning, water cans or anything else that rotates.</p>
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        {visible.map((d) => {
          const err = state.errors?.[d.key];
          const isNew = !d.id;
          const edited = !isNew && !d.deleted && !sameDraft(d, original.get(d.key)!);
          const label = d.name.trim() || "New chore";
          const others = flatmates.filter((f) => !d.rotation.includes(f.id));
          const everyDay = d.days.length === 7;

          if (d.deleted) {
            return (
              <li
                key={d.key}
                className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong py-1.5 pr-1.5 pl-4"
              >
                <span className="min-w-0 text-sm font-semibold text-muted">
                  <span className="line-through">{original.get(d.key)?.name}</span> will be deleted when you save
                </span>
                <button
                  type="button"
                  onClick={() => update(d.key, { deleted: false })}
                  className="min-h-11 shrink-0 rounded-full px-4 text-sm font-bold text-accent hover:bg-accent-tint"
                >
                  Undo
                </button>
              </li>
            );
          }

          const move = (i: number, by: -1 | 1) => {
            const next = [...d.rotation];
            [next[i], next[i + by]] = [next[i + by], next[i]];
            update(d.key, { rotation: next });
          };

          return (
            <li
              key={d.key}
              className={cx(
                "flex min-w-0 flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-4",
                (edited || isNew) && "ring-2 ring-accent/40",
                err && "ring-2 ring-danger/50",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label htmlFor={`chore-${d.key}-name`} className="sr-only">
                    Chore name
                  </label>
                  <input
                    id={`chore-${d.key}-name`}
                    value={d.name}
                    onChange={(e) => update(d.key, { name: e.target.value })}
                    maxLength={40}
                    placeholder="e.g. Garbage"
                    aria-invalid={err?.name ? true : undefined}
                    aria-describedby={err?.name ? `chore-${d.key}-name-error` : undefined}
                    className={cx(inputClass(err?.name), "text-lg font-bold")}
                  />
                  <FieldError id={`chore-${d.key}-name-error`}>{err?.name}</FieldError>
                </div>
                {edited || isNew ? (
                  <span className="mt-2.5 shrink-0 rounded-full bg-accent-tint px-2 py-0.5 text-xs font-bold text-accent-dark">
                    {isNew ? "New" : "Edited"}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    isNew ? setDrafts((cur) => cur.filter((x) => x.key !== d.key)) : update(d.key, { deleted: true })
                  }
                  aria-label={`Delete ${label}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-warn-bg hover:text-danger"
                >
                  <XIcon size={20} />
                </button>
              </div>

              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
                  Which days
                </legend>
                <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1">
                  <button
                    type="button"
                    aria-pressed={everyDay}
                    onClick={() => update(d.key, { days: everyDay ? [] : ALL })}
                    className={cx(chip(everyDay), "px-3")}
                  >
                    Daily
                  </button>
                  {DAYS.map((day, i) => {
                    const on = d.days.includes(i + 1);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        aria-label={day}
                        onClick={() =>
                          update(d.key, {
                            days: on ? d.days.filter((x) => x !== i + 1) : [...d.days, i + 1].sort((a, b) => a - b),
                          })
                        }
                        className={chip(on)}
                      >
                        {day.slice(0, 2)}
                      </button>
                    );
                  })}
                </div>
                <FieldError id={`chore-${d.key}-days-error`}>{err?.days}</FieldError>
              </fieldset>

              <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
                <label htmlFor={`chore-${d.key}-time`} className="text-sm font-semibold">
                  Done by
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`chore-${d.key}-time`}
                    type="time"
                    value={d.dueTime}
                    onChange={(e) => update(d.key, { dueTime: e.target.value })}
                    className={cx(inputClass(err?.dueTime), "max-w-40")}
                  />
                  {d.dueTime ? (
                    <button
                      type="button"
                      onClick={() => update(d.key, { dueTime: "" })}
                      aria-label={`Clear time for ${label}`}
                      className="min-h-11 shrink-0 rounded-full px-3 text-sm font-bold text-muted hover:bg-bg hover:text-ink"
                    >
                      Clear
                    </button>
                  ) : (
                    <span className="text-sm text-muted">Optional</span>
                  )}
                </div>
                <span />
                <FieldError id={`chore-${d.key}-time-error`}>{err?.dueTime}</FieldError>
              </div>

              <details className="group -mx-1 rounded-xl" open={isNew || Boolean(err?.rotation) || undefined}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-1 hover:bg-bg">
                  <span className="text-sm font-semibold">Who takes turns</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {d.rotation.length ? d.rotation.map((id) => nameOf.get(id)).join(" → ") : "Nobody yet"}
                  </span>
                  <ChevronRightIcon size={18} className="shrink-0 text-muted transition-transform group-open:rotate-90" />
                </summary>
                <div className="flex flex-col gap-2 px-1 pt-2">
                  {d.rotation.length ? (
                    <ol className="flex flex-col rounded-xl border border-line-strong">
                      {d.rotation.map((id, i) => (
                        <li key={id} className="flex min-h-12 items-center gap-2 border-b border-line pl-3 last:border-b-0">
                          <span className="w-4 text-sm font-bold text-muted">{i + 1}</span>
                          <Avatar name={nameOf.get(id) ?? "?"} size={28} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{nameOf.get(id)}</span>
                          <button
                            type="button"
                            onClick={() => move(i, -1)}
                            disabled={i === 0}
                            aria-label={`Move ${nameOf.get(id)} up in ${label}`}
                            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-bg disabled:opacity-30"
                          >
                            <ArrowUpIcon size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(i, 1)}
                            disabled={i === d.rotation.length - 1}
                            aria-label={`Move ${nameOf.get(id)} down in ${label}`}
                            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-bg disabled:opacity-30"
                          >
                            <ArrowDownIcon size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => update(d.key, { rotation: d.rotation.filter((x) => x !== id) })}
                            aria-label={`Take ${nameOf.get(id)} out of ${label}`}
                            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-warn-bg hover:text-danger"
                          >
                            <XIcon size={18} />
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {others.length ? (
                    <div className="flex flex-wrap gap-2">
                      {others.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => update(d.key, { rotation: [...d.rotation, f.id] })}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-sm font-bold hover:border-ink/40"
                        >
                          <PlusIcon size={16} />
                          {f.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <FieldError id={`chore-${d.key}-rotation-error`}>{err?.rotation}</FieldError>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addChore}
        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line-strong font-bold text-accent-dark hover:border-accent hover:bg-accent-tint/50"
      >
        <PlusIcon size={20} />
        Add a chore
      </button>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 -mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[calc(var(--radius-card)+4px)] border border-line bg-surface/95 py-2 pr-2 pl-4 shadow-[0_8px_30px_rgb(0_0_0/0.08)] backdrop-blur-md lg:bottom-6 lg:mx-0 lg:py-3 lg:pr-3 lg:pl-5">
        {state.error ? (
          <div className="basis-full">
            <Notice tone="warn">{state.error}</Notice>
          </div>
        ) : null}
        <span className="min-w-0 flex-1 text-sm font-semibold text-muted" aria-live="polite">
          {dirty ? `${changed.length} ${changed.length === 1 ? "chore" : "chores"} changed` : "No changes yet"}
        </span>
        <Button type="submit" loading={pending} disabled={!dirty} className="min-h-12 max-w-fit shrink-0 px-6 lg:min-w-48">
          Save changes
        </Button>
      </div>
    </form>
  );
}
