"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { deleteChore } from "../actions";

function Confirm() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" loading={pending} className="border-danger text-danger hover:bg-warn-bg">
      Yes, delete
    </Button>
  );
}

export function DeleteChoreButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant="ghost" className="text-danger hover:bg-warn-bg" onClick={() => setConfirming(true)}>
        Delete chore
      </Button>
    );
  }
  return (
    <form action={deleteChore} className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-4">
      <p className="font-semibold">Delete this chore and its history?</p>
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
          Keep
        </Button>
        <Confirm />
      </div>
    </form>
  );
}
