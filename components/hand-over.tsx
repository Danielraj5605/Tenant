"use client";

import { useActionState, useState } from "react";
import { handOverDuty, type HandOverState } from "@/app/(app)/chores/actions";
import { Avatar, Button, Notice, cx } from "./ui";
import { RepeatIcon } from "./icons";

/**
 * Monthly chore: hand this turn to another flatmate, for this time only or
 * from now on. Shown to the person on duty and the admin.
 */
export function HandOverButton({
  assignmentId,
  choreName,
  currentId,
  flatmates,
  meId,
}: {
  assignmentId: string;
  choreName: string;
  currentId: string | null;
  flatmates: { id: string; name: string }[];
  meId: string;
}) {
  const [state, action, pending] = useActionState(handOverDuty, {} as HandOverState);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [always, setAlways] = useState(false);
  const others = flatmates.filter((f) => f.id !== currentId);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={others.length === 0}>
        <RepeatIcon size={18} />
        Hand over
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-line-strong p-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="always" value={always ? "true" : "false"} />
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Who takes over {choreName}?</legend>
        <div className="grid grid-cols-2 gap-2">
          {others.map((f) => (
            <label
              key={f.id}
              className={cx(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1.5 text-sm font-bold",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                to === f.id ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong hover:border-ink/40",
              )}
            >
              <input type="radio" name="to" value={f.id} checked={to === f.id} onChange={() => setTo(f.id)} className="sr-only" />
              <Avatar name={f.name} size={28} />
              <span className="min-w-0 truncate">{f.id === meId ? "Me" : f.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">For how long?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: false, label: "Just this time" },
            { value: true, label: "From now on" },
          ].map((o) => (
            <label
              key={o.label}
              className={cx(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-3 text-sm font-bold",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                always === o.value ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong hover:border-ink/40",
              )}
            >
              <input type="radio" name="howLong" checked={always === o.value} onChange={() => setAlways(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">
          {always ? "They'll do it every time from now on." : "Later turns stay with the usual person."}
        </p>
      </fieldset>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="px-5">
          Cancel
        </Button>
        <Button type="submit" loading={pending} disabled={!to}>
          Hand over
        </Button>
      </div>
    </form>
  );
}
