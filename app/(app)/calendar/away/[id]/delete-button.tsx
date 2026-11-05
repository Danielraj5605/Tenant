"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { deleteAway } from "../actions";

function ConfirmDelete() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" loading={pending} className="border-danger text-danger hover:bg-warn-bg">
      Yes, delete
    </Button>
  );
}

export function DeleteAwayButton({ id, back }: { id: string; back: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" className="text-danger hover:bg-warn-bg" onClick={() => setConfirming(true)}>
        Delete these dates
      </Button>
    );
  }

  return (
    <form action={deleteAway} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <p className="font-semibold">Delete these away dates? They&rsquo;ll be counted as home again.</p>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Keep
        </Button>
        <ConfirmDelete />
      </div>
    </form>
  );
}
