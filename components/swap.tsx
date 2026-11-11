"use client";

import { useActionState, useState } from "react";
import { cancelSwap, requestSwap, respondSwap, type SwapState } from "@/app/(app)/chores/actions";
import { Avatar, Button, Notice, cx } from "./ui";
import { RepeatIcon } from "./icons";

const day = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const pill = (on: boolean) =>
  cx(
    "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border py-1 pr-3 pl-1.5 text-sm font-bold",
    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
    on ? "border-accent bg-accent-tint text-accent-dark" : "border-line-strong hover:border-ink/40",
  );

/** On a rotation chore: ask to trade one of my days for someone else's. */
export function SwapButton({
  choreId,
  choreName,
  myDays,
  theirDays,
}: {
  choreId: string;
  choreName: string;
  myDays: string[];
  theirDays: { date: string; memberId: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(requestSwap, {} as SwapState);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState(myDays.length === 1 ? myDays[0] : "");
  const [theirs, setTheirs] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-mx-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-bold text-accent hover:bg-accent-tint"
      >
        <RepeatIcon size={16} />
        Swap a day
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-line-strong p-4">
      <input type="hidden" name="choreId" value={choreId} />
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Your {choreName} day to give away</legend>
        <div className="grid grid-cols-2 gap-2">
          {myDays.map((d) => (
            <label key={d} className={cx(pill(mine === d), "justify-center")}>
              <input type="radio" name="fromDate" value={d} checked={mine === d} onChange={() => setMine(d)} className="sr-only" />
              {day(d)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Their day you&rsquo;ll take</legend>
        <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {theirDays.map((t) => (
            <label key={t.date} className={pill(theirs === t.date)}>
              <input type="radio" name="toDate" value={t.date} checked={theirs === t.date} onChange={() => setTheirs(t.date)} className="sr-only" />
              <Avatar name={t.name} size={28} />
              <span className="min-w-0 truncate">
                {t.name}, {day(t.date)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted">They get a notification and accept or decline. Nothing changes until they accept.</p>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="px-5">
          Cancel
        </Button>
        <Button type="submit" loading={pending} disabled={!mine || !theirs}>
          Ask to swap
        </Button>
      </div>
    </form>
  );
}

/** Accept / Decline for a request someone sent me. */
export function SwapAnswer({ swapId }: { swapId: string }) {
  const [state, action, pending] = useActionState(respondSwap, {} as SwapState);
  const [answer, setAnswer] = useState<"accept" | "decline" | null>(null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="swapId" value={swapId} />
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" name="answer" value="accept" onClick={() => setAnswer("accept")} loading={pending && answer === "accept"} disabled={pending}>
          Accept
        </Button>
        <Button
          type="submit"
          name="answer"
          value="decline"
          variant="secondary"
          onClick={() => setAnswer("decline")}
          loading={pending && answer === "decline"}
          disabled={pending}
        >
          Decline
        </Button>
      </div>
    </form>
  );
}

/** Withdraw my request while it's waiting. */
export function SwapCancel({ swapId }: { swapId: string }) {
  const [state, action, pending] = useActionState(cancelSwap, {} as SwapState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="swapId" value={swapId} />
      {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
      <Button type="submit" variant="ghost" loading={pending} className="w-auto px-4 text-sm">
        Cancel request
      </Button>
    </form>
  );
}
