"use client";

import { useFormStatus } from "react-dom";
import { setChoreDone } from "@/app/(app)/chores/actions";
import { Button } from "./ui";
import { CheckIcon } from "./icons";

function Submit({ done }: { done: boolean }) {
  const { pending } = useFormStatus();
  return done ? (
    <Button type="submit" variant="ghost" loading={pending} className="min-h-11 w-auto px-4 text-sm">
      Undo
    </Button>
  ) : (
    <Button type="submit" loading={pending}>
      {pending ? null : <CheckIcon size={20} />}
      Mark done
    </Button>
  );
}

/** "Mark done" for the owner of today's duty; "Undo" once done. */
export function DutyButton({ assignmentId, done }: { assignmentId: string; done: boolean }) {
  return (
    <form action={setChoreDone}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="done" value={done ? "false" : "true"} />
      <Submit done={done} />
    </form>
  );
}
