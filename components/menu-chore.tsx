"use client";

import { useActionState, useState } from "react";
import { setMenuPlanner, type MenuPlannerState } from "@/app/(app)/chores/actions";
import { Avatar, Button, Notice, cx } from "./ui";
import { RepeatIcon } from "./icons";

/** "Plan the menu": hand it to another flatmate, or choose who does it when nobody does. */
export function MenuPlannerButton({
  currentId,
  flatmates,
  meId,
  label,
}: {
  currentId: string | null;
  flatmates: { id: string; name: string }[];
  meId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(setMenuPlanner, {} as MenuPlannerState);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const others = flatmates.filter((f) => f.id !== currentId);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={others.length === 0}>
        <RepeatIcon size={18} />
        {label}
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-line-strong p-4">
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Who plans the menu from now on?</legend>
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
              <span className="name-wrap">{f.id === meId ? "Me" : f.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="px-5">
          Cancel
        </Button>
        <Button type="submit" loading={pending} disabled={!to}>
          {currentId ? "Hand over" : "Choose"}
        </Button>
      </div>
    </form>
  );
}
