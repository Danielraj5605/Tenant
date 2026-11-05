"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { deleteExpense, settleExpense } from "../actions";

function Submit({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      loading={pending}
      className={danger ? "border-danger text-danger hover:bg-warn-bg" : undefined}
    >
      {children}
    </Button>
  );
}

/** Creator-only actions on an unsettled expense (SPEC §5.5). */
export function ExpenseActions({ id }: { id: string }) {
  const [confirm, setConfirm] = useState<"none" | "settle" | "delete">("none");

  if (confirm !== "none") {
    const settle = confirm === "settle";
    return (
      <form
        action={settle ? settleExpense : deleteExpense}
        className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4"
      >
        <input type="hidden" name="id" value={id} />
        <p className="font-semibold">
          {settle
            ? "Mark this split as settled? Everyone has paid up outside the app, and it can't be edited afterwards."
            : "Delete this split? It disappears from everyone's ledger."}
        </p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => setConfirm("none")}>
            Cancel
          </Button>
          <Submit danger={!settle}>{settle ? "Mark settled" : "Delete"}</Submit>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/money/new?edit=${id}`}
        className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-line-strong bg-surface font-bold hover:border-ink/40"
      >
        Edit split
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setConfirm("settle")}>
          Mark settled
        </Button>
        <Button variant="ghost" className="text-danger hover:bg-warn-bg" onClick={() => setConfirm("delete")}>
          Delete
        </Button>
      </div>
    </div>
  );
}
